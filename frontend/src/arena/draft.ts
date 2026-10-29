import type { ArenaTransport } from "./transport.js";

const KEY_PREFIX = "arena-draft:v2";
const UNKNOWN_PLAYER = "unknown";

export interface DraftScope {
  /**
   * Resolved signed-in player id. A browser can be shared by two accounts, so
   * the id is part of every key; legacy player-less keys are never read.
   */
  playerId: string | null;
  /** Stable transport/Match scope (`ArenaTransport.scopeKey()`). */
  scopeKey: string;
}

/** Minimal storage surface so the repository is testable without a browser. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

function playerSlot(scope: DraftScope): string {
  return scope.playerId ?? UNKNOWN_PLAYER;
}

function scopePrefix(scope: DraftScope): string {
  return `${KEY_PREFIX}:${playerSlot(scope)}:${scope.scopeKey}:`;
}

export function draftKey(scope: DraftScope, round: number, problem: string, language: string): string {
  return `${scopePrefix(scope)}${round}:${problem}:${language}`;
}

/** localStorage adapter; null when storage cannot even be accessed. */
function browserStorage(): DraftStorage | null {
  if (typeof window === "undefined") return null;
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return null;
  }
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
    keys: () => {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) keys.push(key);
      }
      return keys;
    },
  };
}

/**
 * Browser-local editor drafts, isolated by player + transport scope +
 * round/problem/language.
 *
 * Storage failures (private mode, quota, blocked cookies) degrade to a
 * session-memory copy instead of dropping the draft or crashing the editor.
 * Writes prune older-round keys for the same player/scope so a stale round
 * can never resurface after a refresh.
 */
export class DraftRepository {
  private readonly memory = new Map<string, string>();

  constructor(private readonly storage: DraftStorage | null) {}

  load(scope: DraftScope, round: number, problem: string, language: string): string | null {
    const key = draftKey(scope, round, problem, language);
    const sessionValue = this.memory.get(key);
    if (sessionValue !== undefined) return sessionValue;
    if (!this.storage) return null;
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  save(scope: DraftScope, round: number, problem: string, language: string, code: string): void {
    const key = draftKey(scope, round, problem, language);
    this.memory.set(key, code);
    if (!this.storage) return;
    try {
      this.pruneOlderRounds(scope, round);
      this.storage.setItem(key, code);
    } catch {
      // Storage full/blocked: the in-memory copy remains for this session.
    }
  }

  private pruneOlderRounds(scope: DraftScope, round: number): void {
    const prefix = scopePrefix(scope);
    const candidates = new Set<string>(this.memory.keys());
    if (this.storage) {
      try {
        for (const key of this.storage.keys()) candidates.add(key);
      } catch {
        // Keep memory-only behavior when enumeration is blocked.
      }
    }
    for (const key of candidates) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const separator = rest.indexOf(":");
      if (separator <= 0) continue;
      const keyRound = Number(rest.slice(0, separator));
      if (!Number.isInteger(keyRound) || keyRound >= round) continue;
      this.memory.delete(key);
      if (!this.storage) continue;
      try {
        this.storage.removeItem(key);
      } catch {
        // Already unusable; the current write still proceeds.
      }
    }
  }
}

/** Resolve the current draft identity from the transport seam. */
export function draftScopeFor(transport: ArenaTransport): DraftScope {
  let playerId: string | null = null;
  try {
    playerId = transport.playerId?.() ?? null;
  } catch {
    playerId = null;
  }
  return { playerId, scopeKey: transport.scopeKey() };
}

/** Module-level repo used by the mounted Arena page. */
export const drafts = new DraftRepository(browserStorage());
