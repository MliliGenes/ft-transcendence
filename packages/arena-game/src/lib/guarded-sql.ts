import type { Pool, PoolClient } from "pg";

export class GuardedSql {
  constructor(
    private readonly pool: Pool,
    private readonly assertActive: () => void = () => {},
    private readonly authorize: (client: PoolClient) => Promise<void> = async () => {},
  ) {}

  async begin(client: PoolClient): Promise<void> {
    this.assertActive();
    await client.query("BEGIN");
    try {
      await this.authorize(client);
      this.assertActive();
    } catch (error) {
      await this.rollback(client);
      throw error;
    }
  }

  async commit(client: PoolClient): Promise<void> {
    this.assertActive();
    await client.query("COMMIT");
  }

  async rollback(client: PoolClient): Promise<void> {
    // A lost claim connection may already be destroyed. Preserve the domain error.
    await client.query("ROLLBACK").catch(() => {});
  }

  async onClient<T>(client: PoolClient, work: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      await this.begin(client);
      const result = await work(client);
      await this.commit(client);
      return result;
    } catch (error) {
      await this.rollback(client);
      throw error;
    }
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    this.assertActive();
    const client = await this.pool.connect();
    try { return await this.onClient(client, work); }
    finally { client.release(); }
  }
}
