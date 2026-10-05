import { EventEmitter } from "node:events";

/** Socket.IO seam: inbound server events are separate from outbound commands. */
export class TestSocket {
  connected = false;
  active = true;
  readonly io = new EventEmitter();
  readonly outgoing: Array<{ event: string; payload: unknown; ack: (response: unknown) => void }> = [];
  disconnects = 0;
  private readonly inbound = new EventEmitter();
  private timeoutMs: number | undefined;
  private readonly pending = new Set<(error: Error) => void>();

  on(event: string, handler: (...args: any[]) => void): this { this.inbound.on(event, handler); return this; }
  once(event: string, handler: (...args: any[]) => void): this { this.inbound.once(event, handler); return this; }
  off(event: string, handler: (...args: any[]) => void): this { this.inbound.off(event, handler); return this; }
  removeAllListeners(): void { this.inbound.removeAllListeners(); }
  listeners(event: string) { return this.inbound.listeners(event); }
  timeout(ms: number): this { this.timeoutMs = ms; return this; }
  connect(): this { this.connected = true; this.server("connect"); return this; }
  disconnect(): this { this.disconnects++; this.server("disconnect"); return this; }

  server(event: string, ...args: unknown[]): void {
    if (event === "disconnect") this.connected = false;
    this.inbound.emit(event, ...args);
    if (event === "disconnect") for (const cancel of this.pending) cancel(new Error("disconnected"));
  }

  emit(event: string, payload: unknown, callback?: (...args: any[]) => void): this {
    const timeout = this.timeoutMs;
    this.timeoutMs = undefined;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error: Error | null, response?: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      this.pending.delete(cancel);
      if (timeout !== undefined) callback?.(error, response);
      else callback?.(response);
    };
    const cancel = (error: Error) => finish(error);
    if (timeout !== undefined) {
      timer = setTimeout(() => cancel(new Error("ack timeout")), timeout);
      this.pending.add(cancel);
    }
    this.outgoing.push({ event, payload, ack: (response) => finish(null, response) });
    return this;
  }
}
