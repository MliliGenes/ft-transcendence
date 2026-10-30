import type { TeamChatClient } from "./chat.js";
import type { CollabClient } from "./collab.js";
import { SidecarSlot } from "./sidecar-slot.js";

export interface LiveClientConfig {
  baseUrl: string;
  userId: string;
  matchId: string;
  getAccessToken?: () => string | null;
}

export interface SidecarScope {
  transportKey: object;
  round: number;
  collabConfig: LiveClientConfig | null;
  chatConfig: LiveClientConfig | null;
}

export interface SidecarState {
  collab: CollabClient | null;
  chat: TeamChatClient | null;
}

export interface SidecarFactories {
  createCollab(config: LiveClientConfig): Promise<CollabClient>;
  createChat(config: LiveClientConfig): Promise<TeamChatClient>;
}

export interface ArenaSidecarLifecycle {
  sync(scope: SidecarScope): Promise<SidecarState | null>;
  getState(): SidecarState;
  /** Explicit renewal after a session rotation: fresh sockets, kept state. */
  renew(): Promise<void>;
  dispose(): void;
}

interface ScopeIdentity {
  transportKey: object;
  matchId: string | null;
}

const defaultFactories: SidecarFactories = {
  createCollab: async (config) => {
    const { CollabClient } = await import("./collab.js");
    return new CollabClient({ ...config, displayName: config.userId });
  },
  createChat: async (config) => {
    const { TeamChatClient } = await import("./chat.js");
    return new TeamChatClient(config);
  },
};

function configKey(config: LiveClientConfig): string {
  return JSON.stringify([config.baseUrl, config.userId, config.matchId]);
}

function sameScope(left: ScopeIdentity, right: ScopeIdentity): boolean {
  return Object.is(left.transportKey, right.transportKey) && left.matchId === right.matchId;
}

function matchId(scope: SidecarScope): string | null {
  return scope.chatConfig?.matchId ?? scope.collabConfig?.matchId ?? null;
}

function computeKeys(scope: SidecarScope): { collabKey: string | null; chatKey: string | null } {
  return {
    collabKey: scope.collabConfig ? `${scope.round}:${configKey(scope.collabConfig)}` : null,
    chatKey: scope.chatConfig ? configKey(scope.chatConfig) : null,
  };
}

function fetchSidecars(
  scope: SidecarScope,
  collabSlot: SidecarSlot<CollabClient>,
  chatSlot: SidecarSlot<TeamChatClient>,
  collabKey: string | null,
  chatKey: string | null,
  isDisposed: () => boolean,
): Promise<[CollabClient | null, TeamChatClient | null]> {
  const collabPromise = scope.collabConfig
    ? collabSlot.ensure(scope.collabConfig, collabKey!, isDisposed)
    : Promise.resolve(null);
  const chatPromise = scope.chatConfig
    ? chatSlot.ensure(scope.chatConfig, chatKey!, isDisposed)
    : Promise.resolve(null);
  return Promise.all([collabPromise, chatPromise]);
}

export function createArenaSidecarLifecycle(factories: SidecarFactories = defaultFactories): ArenaSidecarLifecycle {
  let disposed = false;
  let requestVersion = 0;
  let identity: ScopeIdentity | null = null;

  const collabSlot = new SidecarSlot(factories.createCollab);
  const chatSlot = new SidecarSlot(factories.createChat);

  const isDisposed = () => disposed;

  function state(): SidecarState {
    return { collab: collabSlot.client, chat: chatSlot.client };
  }

  function alignScope(scope: SidecarScope): void {
    const nextIdentity = { transportKey: scope.transportKey, matchId: matchId(scope) } satisfies ScopeIdentity;
    if (!identity || !sameScope(identity, nextIdentity)) {
      collabSlot.clear();
      chatSlot.clear();
      identity = nextIdentity;
    }
  }

  async function sync(scope: SidecarScope): Promise<SidecarState | null> {
    disposed = false;
    const version = ++requestVersion;
    alignScope(scope);

    const { collabKey, chatKey } = computeKeys(scope);
    collabSlot.prune(collabKey);
    chatSlot.prune(chatKey);

    try {
      const [nextCollab, nextChat] = await fetchSidecars(
        scope,
        collabSlot,
        chatSlot,
        collabKey,
        chatKey,
        isDisposed,
      );
      if (version !== requestVersion || disposed) return null;

      collabSlot.adopt(nextCollab, collabKey);
      chatSlot.adopt(nextChat, chatKey);
      return state();
    } catch (error) {
      if (version === requestVersion && !disposed) {
        collabSlot.onSyncError(collabKey);
        chatSlot.onSyncError(chatKey);
      }
      throw error;
    }
  }

  function dispose(): void {
    disposed = true;
    requestVersion++;
    collabSlot.clear();
    chatSlot.clear();
    identity = null;
  }

  async function renew(): Promise<void> {
    if (disposed) return;
    await Promise.allSettled([collabSlot.renewSocket(), chatSlot.renewSocket()]);
  }

  return {
    sync,
    getState: state,
    renew,
    dispose,
  };
}
