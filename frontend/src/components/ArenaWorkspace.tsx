import { useEffect, useState } from "react";
import { CodeWorkspace } from "./CodeWorkspace.js";
import { MatchPanel } from "./MatchPanel.js";
import { ProblemPanel } from "./ProblemPanel.js";
import type { ArenaTransport } from "../arena/transport.js";
import type { CollabClient } from "../arena/collab.js";
import type { TeamChatClient } from "../arena/chat.js";
import type { ArenaSnapshot } from "../arena/types.js";

function isCollabReady(collab: CollabClient | null | undefined, snapshot: ArenaSnapshot): boolean {
  if (!collab) return true;
  return (
    collab.connection() === "connected" &&
    !collab.hasPendingUpdates &&
    collab.recoverySource === null &&
    collab.revision === snapshot.docRevision &&
    collab.language === snapshot.language
  );
}

function isSharedActionReady(
  transport: ArenaTransport,
  collab: CollabClient | null | undefined,
  snapshot: ArenaSnapshot
): boolean {
  return transport.connection() === "connected" && isCollabReady(collab, snapshot);
}

function isReadyDisabled(sharedActionsReady: boolean, snapshot: ArenaSnapshot): boolean {
  if (!sharedActionsReady) return true;
  return snapshot.roundPhase !== "CODING" || snapshot.you.status !== "coding";
}

export function ArenaWorkspace({
  snapshot,
  transport,
  code,
  onCode,
  collab,
  chat,
}: {
  snapshot: ArenaSnapshot;
  transport: ArenaTransport;
  code: string;
  onCode: (code: string) => void;
  collab?: CollabClient | null;
  chat?: TeamChatClient | null;
}) {
  const [, refreshCollaboration] = useState(0);

  useEffect(() => {
    if (!collab) return;
    return collab.subscribe(() => refreshCollaboration((value) => value + 1));
  }, [collab]);

  useEffect(() => {
    if (!collab) return;
    void collab.reconcile(snapshot.docRevision, snapshot.language).catch(() => {});
  }, [collab, snapshot.docRevision, snapshot.language, collab?.hasPendingUpdates, collab?.revision, collab?.language]);

  const sharedActionsReady = isSharedActionReady(transport, collab, snapshot);
  const readyDisabled = isReadyDisabled(sharedActionsReady, snapshot);

  const handleSetReady = (v: boolean) => {
    if (sharedActionsReady) {
      void transport.setReady(v).catch(() => {});
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_minmax(0,4fr)]">
      <ProblemPanel problem={snapshot.problem} />
      <CodeWorkspace snapshot={snapshot} transport={transport} code={code} onCode={onCode} collab={collab} />
      {/*
        ponytail: readiness checkbox is optimistic; the authoritative snapshot
        corrects it on the next refresh. Rejections (e.g. stale revision)
        stay silent here so a racing invalidate never pops a console error.
      */}
      <MatchPanel
        snapshot={snapshot}
        readyDisabled={readyDisabled}
        onSetReady={handleSetReady}
        chat={chat}
      />
    </div>
  );
}
