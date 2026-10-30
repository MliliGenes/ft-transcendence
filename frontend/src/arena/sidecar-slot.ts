export interface LiveClientConfig {
  baseUrl: string;
  userId: string;
  matchId: string;
  getAccessToken?: () => string | null;
}

export type DisposableClient = {
  disconnect(): void;
  dispose?(): void;
  renewSocket?(): Promise<unknown>;
};

export interface PendingClient<T> {
  key: string;
  cancelled: boolean;
  client: T | null;
  promise: Promise<T | null>;
}

export function disconnectClient(client: DisposableClient): void {
  try {
    if (client.dispose) client.dispose();
    else client.disconnect();
  } catch {
    // Disposal is best effort so one sidecar cannot strand the other.
  }
}

export class SidecarSlot<T extends DisposableClient> {
  private activeClient: T | null = null;
  private activeKey: string | null = null;
  private pending: PendingClient<T> | null = null;

  constructor(private readonly factory: (config: LiveClientConfig) => Promise<T>) {}

  get client(): T | null {
    return this.activeClient;
  }

  cancelPending(): void {
    const p = this.pending;
    if (!p) return;
    p.cancelled = true;
    if (p.client) {
      disconnectClient(p.client);
      p.client = null;
    }
    this.pending = null;
  }

  clear(): void {
    this.cancelPending();
    if (this.activeClient) disconnectClient(this.activeClient);
    this.activeClient = null;
    this.activeKey = null;
  }

  prune(desiredKey: string | null): void {
    if (desiredKey === null || (this.activeKey !== desiredKey && this.pending?.key !== desiredKey)) {
      this.clear();
    }
  }

  ensure(config: LiveClientConfig, key: string, isDisposed: () => boolean): Promise<T | null> {
    if (this.activeClient && this.activeKey === key) {
      return Promise.resolve(this.activeClient);
    }
    if (this.pending?.key === key) {
      return this.pending.promise;
    }
    const pending: PendingClient<T> = {
      key,
      cancelled: false,
      client: null,
      promise: Promise.resolve(null) as Promise<T | null>,
    };

    pending.promise = Promise.resolve()
      .then(() => this.factory(config))
      .then(
        (client) => {
          if (pending.cancelled || isDisposed()) {
            disconnectClient(client);
            return null;
          }
          pending.client = client;
          return client;
        },
        (error: unknown) => {
          if (pending.cancelled || isDisposed()) return null;
          throw error;
        },
      );

    this.pending = pending;
    return pending.promise;
  }

  adopt(nextClient: T | null, desiredKey: string | null): void {
    if (nextClient) {
      this.activeClient = nextClient;
      this.activeKey = desiredKey;
      if (this.pending?.client === nextClient) {
        this.pending.client = null;
      }
      this.pending = null;
    }
  }

  onSyncError(desiredKey: string | null): void {
    if (this.pending?.key === desiredKey) {
      this.clear();
    }
  }

  async renewSocket(): Promise<void> {
    await this.activeClient?.renewSocket?.();
  }
}
