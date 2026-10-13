import { randomUUID } from "node:crypto";
import { Client, type PoolClient } from "pg";

export class RuntimeOwnershipLostError extends Error {
  readonly code = 503;
  constructor(message = "Game runtime ownership is unavailable", readonly cause?: unknown) {
    super(message);
    this.name = "RuntimeOwnershipLostError";
  }
}

export class RuntimeAlreadyOwnedError extends Error {
  readonly code = 503;
  constructor() {
    super("Another Game runtime already owns this database");
    this.name = "RuntimeAlreadyOwnedError";
  }
}

export class RuntimeOwnership {
  readonly bootId = randomUUID();
  private readonly client: Client;
  private state: "new" | "acquiring" | "active" | "lost" | "stopping" | "closed" = "new";
  private failure?: RuntimeOwnershipLostError;
  private onLost?: (error: RuntimeOwnershipLostError) => void;
  private probeTimer?: NodeJS.Timeout;
  private closePromise?: Promise<void>;

  constructor(connectionString: string) {
    this.client = new Client({
      connectionString,
      application_name: "arena-game-runtime-owner",
      connectionTimeoutMillis: 2000,
      query_timeout: 2000,
    });
    this.client.on("error", (error) => this.lose(error));
    this.client.on("end", () => {
      if (this.state === "active" || this.state === "acquiring") {
        this.lose(new Error("ownership session ended"));
      }
    });
  }

  get active(): boolean { return this.state === "active"; }

  assertActive(): void {
    if (!this.active) throw this.failure ?? new RuntimeOwnershipLostError();
  }

  async acquire(onLost?: (error: RuntimeOwnershipLostError) => void): Promise<void> {
    if (this.active) return;
    if (this.state !== "new") throw this.failure ?? new RuntimeOwnershipLostError();
    this.state = "acquiring";
    this.onLost = onLost;
    try {
      await this.client.connect();
      const admission = await this.client.query<{ owned: boolean }>(
        "SELECT pg_try_advisory_lock(1179931201, 1) AS owned",
      );
      if (!admission.rows[0]?.owned) throw new RuntimeAlreadyOwnedError();
      await this.client.query("BEGIN");
      await this.client.query("SET LOCAL lock_timeout = '2000ms'");
      await this.client.query("SET LOCAL statement_timeout = '2000ms'");
      await this.client.query(`CREATE TABLE IF NOT EXISTS arena_runtime_ownership (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        boot_id UUID NOT NULL
      )`);
      await this.client.query(
        "INSERT INTO arena_runtime_ownership (singleton_id, boot_id) VALUES (1, $1) ON CONFLICT (singleton_id) DO NOTHING",
        [this.bootId],
      );
      await this.client.query("SELECT boot_id FROM arena_runtime_ownership WHERE singleton_id = 1 FOR UPDATE");
      await this.client.query("UPDATE arena_runtime_ownership SET boot_id = $1 WHERE singleton_id = 1", [this.bootId]);
      await this.client.query("COMMIT");
      if (this.state !== "acquiring") throw this.failure ?? new RuntimeOwnershipLostError();
      this.state = "active";
      this.scheduleProbe();
    } catch (error) {
      if (!(error instanceof RuntimeAlreadyOwnedError)) this.lose(error);
      await this.close();
      throw error;
    }
  }

  async guard(client: PoolClient): Promise<void> {
    this.assertActive();
    let observed: string | undefined;
    try {
      const result = await client.query<{ boot_id: string }>(
        "SELECT boot_id FROM arena_runtime_ownership WHERE singleton_id = 1 FOR SHARE",
      );
      observed = result.rows[0]?.boot_id;
    } catch (cause) {
      const error = new RuntimeOwnershipLostError("Game runtime ownership check failed", cause);
      this.lose(error);
      throw error;
    }
    if (observed !== this.bootId) {
      const error = new RuntimeOwnershipLostError("Game runtime boot token was superseded");
      this.lose(error);
      throw error;
    }
    this.assertActive();
  }

  lose(cause: unknown): void {
    if (this.state === "lost" || this.state === "stopping" || this.state === "closed") return;
    this.failure = cause instanceof RuntimeOwnershipLostError
      ? cause : new RuntimeOwnershipLostError("Game runtime ownership session was lost", cause);
    this.state = "lost";
    if (this.probeTimer) clearTimeout(this.probeTimer);
    try { this.onLost?.(this.failure); } catch { console.error("Game ownership loss callback failed"); }
    // Destroy the dedicated session on terminal probe failure too; no reconnect.
    void this.close().catch(() => console.error("Game ownership session close failed"));
  }

  stopAdmission(): void {
    if (this.state === "closed") return;
    this.state = "stopping";
    if (this.probeTimer) clearTimeout(this.probeTimer);
  }

  close(): Promise<void> {
    if (!this.closePromise) {
      this.stopAdmission();
      this.closePromise = this.client.end().finally(() => { this.state = "closed"; });
    }
    return this.closePromise;
  }

  private scheduleProbe(): void {
    if (!this.active) return;
    this.probeTimer = setTimeout(() => { void this.probe(); }, 1000);
    this.probeTimer.unref();
  }

  private async probe(): Promise<void> {
    try {
      this.assertActive();
      await this.client.query("SELECT 1");
    } catch (error) {
      if (this.active) this.lose(error);
    } finally {
      this.scheduleProbe();
    }
  }
}
