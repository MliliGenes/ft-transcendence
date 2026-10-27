import { describe, expect, it, vi } from "vitest";
import type { TeamChatClient } from "./chat.js";
import type { CollabClient } from "./collab.js";
import {
  createArenaSidecarLifecycle,
  type LiveClientConfig,
  type SidecarScope,
} from "./sidecars.js";

const config = (matchId = "match-1"): LiveClientConfig => ({
  baseUrl: "http://localhost:3220",
  userId: "user-1",
  matchId,
});

function scope(transportKey: object, round: number, matchId = "match-1"): SidecarScope {
  return {
    transportKey,
    round,
    collabConfig: config(matchId),
    chatConfig: config(matchId),
  };
}

function collabClient(): CollabClient & { disconnect: ReturnType<typeof vi.fn> } {
  return { disconnect: vi.fn() } as unknown as CollabClient & { disconnect: ReturnType<typeof vi.fn> };
}

function chatClient(): TeamChatClient & { disconnect: ReturnType<typeof vi.fn> } {
  return { disconnect: vi.fn() } as unknown as TeamChatClient & { disconnect: ReturnType<typeof vi.fn> };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("arena sidecar lifecycle", () => {
  it("permanently disposes a replaced Round when the client supports it", async () => {
    const first = { disconnect: vi.fn(), dispose: vi.fn() } as unknown as CollabClient;
    const second = collabClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
      createChat: vi.fn().mockResolvedValue(chatClient()),
    });
    const key = {};
    await lifecycle.sync(scope(key, 1));
    await lifecycle.sync(scope(key, 2));
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(first.disconnect).not.toHaveBeenCalled();
    lifecycle.dispose();
  });
  it("replaces collaboration per round while preserving match-scoped chat", async () => {
    const transportKey = {};
    const firstCollab = collabClient();
    const secondCollab = collabClient();
    const chat = chatClient();
    const nextCollab = deferred<CollabClient>();
    const createCollab = vi
      .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
      .mockResolvedValueOnce(firstCollab)
      .mockReturnValueOnce(nextCollab.promise);
    const createChat = vi.fn<(input: LiveClientConfig) => Promise<TeamChatClient>>().mockResolvedValue(chat);
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

    expect(await lifecycle.sync(scope(transportKey, 1))).toEqual({ collab: firstCollab, chat });

    const nextRound = lifecycle.sync(scope(transportKey, 2));
    expect(firstCollab.disconnect).toHaveBeenCalledTimes(1);
    expect(lifecycle.getState().chat).toBe(chat);
    expect(createChat).toHaveBeenCalledTimes(1);

    nextCollab.resolve(secondCollab);
    expect(await nextRound).toEqual({ collab: secondCollab, chat });
    expect(chat.disconnect).not.toHaveBeenCalled();
  });

  it("disposes both clients when the match changes", async () => {
    const transportKey = {};
    const firstCollab = collabClient();
    const secondCollab = collabClient();
    const firstChat = chatClient();
    const secondChat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi
        .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
        .mockResolvedValueOnce(firstCollab)
        .mockResolvedValueOnce(secondCollab),
      createChat: vi
        .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
        .mockResolvedValueOnce(firstChat)
        .mockResolvedValueOnce(secondChat),
    });

    await lifecycle.sync(scope(transportKey, 1, "match-1"));
    expect(await lifecycle.sync(scope(transportKey, 1, "match-2"))).toEqual({ collab: secondCollab, chat: secondChat });

    expect(firstCollab.disconnect).toHaveBeenCalledTimes(1);
    expect(firstChat.disconnect).toHaveBeenCalledTimes(1);
  });

  it("disposes both clients when the transport changes", async () => {
    const firstTransport = {};
    const secondTransport = {};
    const firstCollab = collabClient();
    const secondCollab = collabClient();
    const firstChat = chatClient();
    const secondChat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi
        .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
        .mockResolvedValueOnce(firstCollab)
        .mockResolvedValueOnce(secondCollab),
      createChat: vi
        .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
        .mockResolvedValueOnce(firstChat)
        .mockResolvedValueOnce(secondChat),
    });

    await lifecycle.sync(scope(firstTransport, 1));
    expect(await lifecycle.sync(scope(secondTransport, 1))).toEqual({ collab: secondCollab, chat: secondChat });

    expect(firstCollab.disconnect).toHaveBeenCalledTimes(1);
    expect(firstChat.disconnect).toHaveBeenCalledTimes(1);
  });

  it("cancels a stale factory and disposes a client that resolves after replacement", async () => {
    const transportKey = {};
    const staleCollab = collabClient();
    const currentCollab = collabClient();
    const staleFactory = deferred<CollabClient>();
    const createCollab = vi
      .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
      .mockReturnValueOnce(staleFactory.promise)
      .mockResolvedValueOnce(currentCollab);
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat: vi.fn() });
    const collabOnlyScope = (round: number): SidecarScope => ({
      transportKey,
      round,
      collabConfig: config(),
      chatConfig: null,
    });

    const staleSync = lifecycle.sync(collabOnlyScope(1));
    const currentSync = lifecycle.sync(collabOnlyScope(2));
    expect(await currentSync).toEqual({ collab: currentCollab, chat: null });

    staleFactory.resolve(staleCollab);
    expect(await staleSync).toBeNull();
    expect(staleCollab.disconnect).toHaveBeenCalledTimes(1);
    expect(lifecycle.getState()).toEqual({ collab: currentCollab, chat: null });
  });

  it.each(["collaboration", "chat"] as const)(
    "reuses both pending clients when an identical sync overlaps and %s resolves first",
    async (first) => {
      const transportKey = {};
      const collab = collabClient();
      const chat = chatClient();
      const pendingCollab = deferred<CollabClient>();
      const pendingChat = deferred<TeamChatClient>();
      const createCollab = vi.fn(() => pendingCollab.promise);
      const createChat = vi.fn(() => pendingChat.promise);
      const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

      const firstSync = lifecycle.sync(scope(transportKey, 1));
      const secondSync = lifecycle.sync(scope(transportKey, 1));
      await tick();
      expect(createCollab).toHaveBeenCalledTimes(1);
      expect(createChat).toHaveBeenCalledTimes(1);

      if (first === "collaboration") {
        pendingCollab.resolve(collab);
        await tick();
        pendingChat.resolve(chat);
      } else {
        pendingChat.resolve(chat);
        await tick();
        pendingCollab.resolve(collab);
      }

      expect(await secondSync).toEqual({ collab, chat });
      expect(await firstSync).toBeNull();
      expect(lifecycle.getState()).toEqual({ collab, chat });
      expect(collab.disconnect).not.toHaveBeenCalled();
      expect(chat.disconnect).not.toHaveBeenCalled();

      lifecycle.dispose();
      expect(collab.disconnect).toHaveBeenCalledOnce();
      expect(chat.disconnect).toHaveBeenCalledOnce();
    },
  );

  it("reuses a pending client that resolved before an overlapping sync started", async () => {
    const transportKey = {};
    const collab = collabClient();
    const chat = chatClient();
    const pendingChat = deferred<TeamChatClient>();
    const createCollab = vi.fn().mockResolvedValue(collab);
    const createChat = vi.fn(() => pendingChat.promise);
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

    const firstSync = lifecycle.sync(scope(transportKey, 1));
    await tick();
    expect(createCollab).toHaveBeenCalledTimes(1);

    const secondSync = lifecycle.sync(scope(transportKey, 1));
    expect(createCollab).toHaveBeenCalledTimes(1);
    expect(collab.disconnect).not.toHaveBeenCalled();

    pendingChat.resolve(chat);

    expect(await secondSync).toEqual({ collab, chat });
    expect(await firstSync).toBeNull();
    expect(lifecycle.getState()).toEqual({ collab, chat });
    expect(collab.disconnect).not.toHaveBeenCalled();
    expect(chat.disconnect).not.toHaveBeenCalled();

    lifecycle.dispose();
    expect(collab.disconnect).toHaveBeenCalledOnce();
    expect(chat.disconnect).toHaveBeenCalledOnce();
  });

  it("replaces both clients when the live-client config changes in the same scope", async () => {
    const transportKey = {};
    const firstCollab = collabClient();
    const secondCollab = collabClient();
    const firstChat = chatClient();
    const secondChat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi.fn().mockResolvedValueOnce(firstCollab).mockResolvedValueOnce(secondCollab),
      createChat: vi.fn().mockResolvedValueOnce(firstChat).mockResolvedValueOnce(secondChat),
    });

    const initial = scope(transportKey, 1);
    await lifecycle.sync(initial);
    const changed = scope(transportKey, 1);
    changed.collabConfig = { ...config(), baseUrl: "http://localhost:3221" };
    changed.chatConfig = { ...config(), baseUrl: "http://localhost:3221" };

    expect(await lifecycle.sync(changed)).toEqual({ collab: secondCollab, chat: secondChat });
    expect(firstCollab.disconnect).toHaveBeenCalledOnce();
    expect(firstChat.disconnect).toHaveBeenCalledOnce();
    expect(secondCollab.disconnect).not.toHaveBeenCalled();
    expect(secondChat.disconnect).not.toHaveBeenCalled();
  });

  it("removes only the sidecar whose live-client config is removed", async () => {
    const transportKey = {};
    const collab = collabClient();
    const chat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi.fn().mockResolvedValue(collab),
      createChat: vi.fn().mockResolvedValue(chat),
    });

    const initial = scope(transportKey, 1);
    await lifecycle.sync(initial);

    expect(await lifecycle.sync({ ...initial, collabConfig: null })).toEqual({ collab: null, chat });
    expect(collab.disconnect).toHaveBeenCalledOnce();
    expect(chat.disconnect).not.toHaveBeenCalled();

    expect(await lifecycle.sync({ ...initial, collabConfig: null, chatConfig: null })).toEqual({
      collab: null,
      chat: null,
    });
    expect(chat.disconnect).toHaveBeenCalledOnce();
    expect(collab.disconnect).toHaveBeenCalledOnce();
  });

  it.each(["collaboration", "chat"] as const)(
    "retires a removed pending %s and constructs fresh work when it returns",
    async (removed) => {
      const transportKey = {};
      const firstCollab = collabClient();
      const firstChat = chatClient();
      const freshCollab = collabClient();
      const freshChat = chatClient();
      const pendingCollab = deferred<CollabClient>();
      const pendingChat = deferred<TeamChatClient>();
      const createCollab = vi
        .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
        .mockReturnValueOnce(pendingCollab.promise)
        .mockResolvedValueOnce(freshCollab);
      const createChat = vi
        .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
        .mockReturnValueOnce(pendingChat.promise)
        .mockResolvedValueOnce(freshChat);
      const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });
      const initial = scope(transportKey, 1);

      const firstSync = lifecycle.sync(initial);
      await tick();
      expect(createCollab).toHaveBeenCalledTimes(1);
      expect(createChat).toHaveBeenCalledTimes(1);

      const removalScope: SidecarScope = {
        ...initial,
        collabConfig: removed === "collaboration" ? null : initial.collabConfig,
        chatConfig: removed === "chat" ? null : initial.chatConfig,
      };
      const removalSync = lifecycle.sync(removalScope);

      if (removed === "collaboration") {
        pendingCollab.resolve(firstCollab);
        await tick();
        expect(firstCollab.disconnect).toHaveBeenCalledOnce();
        expect(firstChat.disconnect).not.toHaveBeenCalled();
        pendingChat.resolve(firstChat);
        expect(await removalSync).toEqual({ collab: null, chat: firstChat });
      } else {
        pendingChat.resolve(firstChat);
        await tick();
        expect(firstChat.disconnect).toHaveBeenCalledOnce();
        expect(firstCollab.disconnect).not.toHaveBeenCalled();
        pendingCollab.resolve(firstCollab);
        expect(await removalSync).toEqual({ collab: firstCollab, chat: null });
      }
      expect(await firstSync).toBeNull();
      expect(lifecycle.getState()).toEqual(
        removed === "collaboration" ? { collab: null, chat: firstChat } : { collab: firstCollab, chat: null },
      );

      const readded = lifecycle.sync(initial);
      if (removed === "collaboration") {
        expect(await readded).toEqual({ collab: freshCollab, chat: firstChat });
        expect(createCollab).toHaveBeenCalledTimes(2);
        expect(createChat).toHaveBeenCalledTimes(1);
        expect(freshCollab.disconnect).not.toHaveBeenCalled();
        expect(firstChat.disconnect).not.toHaveBeenCalled();
      } else {
        expect(await readded).toEqual({ collab: firstCollab, chat: freshChat });
        expect(createCollab).toHaveBeenCalledTimes(1);
        expect(createChat).toHaveBeenCalledTimes(2);
        expect(freshChat.disconnect).not.toHaveBeenCalled();
        expect(firstCollab.disconnect).not.toHaveBeenCalled();
      }

      lifecycle.dispose();
      expect(firstCollab.disconnect).toHaveBeenCalledOnce();
      expect(firstChat.disconnect).toHaveBeenCalledOnce();
      if (removed === "collaboration") {
        expect(freshCollab.disconnect).toHaveBeenCalledOnce();
        expect(freshChat.disconnect).not.toHaveBeenCalled();
      } else {
        expect(freshChat.disconnect).toHaveBeenCalledOnce();
        expect(freshCollab.disconnect).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["collaboration", "chat"] as const)(
    "disposes a resolved pending %s when its config is removed",
    async (removed) => {
      const transportKey = {};
      const firstCollab = collabClient();
      const firstChat = chatClient();
      const pendingCollab = deferred<CollabClient>();
      const pendingChat = deferred<TeamChatClient>();
      const createCollab = vi
        .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
        .mockReturnValueOnce(pendingCollab.promise)
        .mockResolvedValue(firstCollab);
      const createChat = vi
        .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
        .mockReturnValueOnce(pendingChat.promise)
        .mockResolvedValue(firstChat);
      const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });
      const initial = scope(transportKey, 1);

      const firstSync = lifecycle.sync(initial);
      await tick();
      if (removed === "collaboration") {
        pendingCollab.resolve(firstCollab);
      } else {
        pendingChat.resolve(firstChat);
      }
      await tick();

      const removalScope: SidecarScope = {
        ...initial,
        collabConfig: removed === "collaboration" ? null : initial.collabConfig,
        chatConfig: removed === "chat" ? null : initial.chatConfig,
      };
      const removalSync = lifecycle.sync(removalScope);

      if (removed === "collaboration") {
        expect(firstCollab.disconnect).toHaveBeenCalledOnce();
        expect(firstChat.disconnect).not.toHaveBeenCalled();
        pendingChat.resolve(firstChat);
        expect(await removalSync).toEqual({ collab: null, chat: firstChat });
      } else {
        expect(firstChat.disconnect).toHaveBeenCalledOnce();
        expect(firstCollab.disconnect).not.toHaveBeenCalled();
        pendingCollab.resolve(firstCollab);
        expect(await removalSync).toEqual({ collab: firstCollab, chat: null });
      }
      expect(await firstSync).toBeNull();
      expect(lifecycle.getState()).toEqual(
        removed === "collaboration" ? { collab: null, chat: firstChat } : { collab: firstCollab, chat: null },
      );
    },
  );

  it("retries factories that failed on the previous sync", async () => {
    const transportKey = {};
    const collab = collabClient();
    const chat = chatClient();
    const createCollab = vi
      .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
      .mockRejectedValueOnce(new Error("collab unavailable"))
      .mockResolvedValueOnce(collab);
    const createChat = vi
      .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
      .mockRejectedValueOnce(new Error("chat unavailable"))
      .mockResolvedValueOnce(chat);
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

    await expect(lifecycle.sync(scope(transportKey, 1))).rejects.toThrow();
    expect(await lifecycle.sync(scope(transportKey, 1))).toEqual({ collab, chat });
    expect(createCollab).toHaveBeenCalledTimes(2);
    expect(createChat).toHaveBeenCalledTimes(2);
    expect(collab.disconnect).not.toHaveBeenCalled();
    expect(chat.disconnect).not.toHaveBeenCalled();
  });

  it("renews retained clients without recreating them", async () => {
    const transportKey = {};
    const collab = {
      disconnect: vi.fn(),
      renewSocket: vi.fn().mockResolvedValue({}),
    } as unknown as CollabClient;
    const chat = {
      disconnect: vi.fn(),
      renewSocket: vi.fn().mockResolvedValue(undefined),
    } as unknown as TeamChatClient;
    const createCollab = vi.fn().mockResolvedValue(collab);
    const createChat = vi.fn().mockResolvedValue(chat);
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

    await lifecycle.sync(scope(transportKey, 1));
    await lifecycle.renew();

    expect(collab.renewSocket).toHaveBeenCalledOnce();
    expect(chat.renewSocket).toHaveBeenCalledOnce();
    expect(createCollab).toHaveBeenCalledOnce();
    expect(createChat).toHaveBeenCalledOnce();
    expect(collab.disconnect).not.toHaveBeenCalled();
    expect(chat.disconnect).not.toHaveBeenCalled();
  });

  it("disposes a stale chat client that resolves after its config is replaced", async () => {
    const transportKey = {};
    const staleChat = chatClient();
    const currentChat = chatClient();
    const staleFactory = deferred<TeamChatClient>();
    const createChat = vi
      .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
      .mockReturnValueOnce(staleFactory.promise)
      .mockResolvedValueOnce(currentChat);
    const lifecycle = createArenaSidecarLifecycle({ createCollab: vi.fn(), createChat });
    const chatOnlyScope = (baseUrl: string): SidecarScope => ({
      transportKey,
      round: 1,
      collabConfig: null,
      chatConfig: { ...config(), baseUrl },
    });

    const staleSync = lifecycle.sync(chatOnlyScope("http://localhost:3220"));
    const currentSync = lifecycle.sync(chatOnlyScope("http://localhost:3221"));
    expect(await currentSync).toEqual({ collab: null, chat: currentChat });

    staleFactory.resolve(staleChat);
    expect(await staleSync).toBeNull();
    expect(staleChat.disconnect).toHaveBeenCalledOnce();
    expect(lifecycle.getState()).toEqual({ collab: null, chat: currentChat });
  });

  it("does not create clients when the transport exposes no live sidecar configs", async () => {
    const createCollab = vi.fn<(input: LiveClientConfig) => Promise<CollabClient>>();
    const createChat = vi.fn<(input: LiveClientConfig) => Promise<TeamChatClient>>();
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

    const result = await lifecycle.sync({
      transportKey: {},
      round: 1,
      collabConfig: null,
      chatConfig: null,
    });

    expect(result).toEqual({ collab: null, chat: null });
    expect(createCollab).not.toHaveBeenCalled();
    expect(createChat).not.toHaveBeenCalled();
  });

  it("disconnects active clients when the lifecycle is disposed", async () => {
    const collab = collabClient();
    const chat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi.fn().mockResolvedValue(collab),
      createChat: vi.fn().mockResolvedValue(chat),
    });

    await lifecycle.sync(scope({}, 1));
    lifecycle.dispose();

    expect(collab.disconnect).toHaveBeenCalledTimes(1);
    expect(chat.disconnect).toHaveBeenCalledTimes(1);
    expect(lifecycle.getState()).toEqual({ collab: null, chat: null });
  });
});
