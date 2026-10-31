import { useRef, useState } from "react";
import { EditorAdapter, type EditorAdapterHandle } from "./EditorAdapter.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { TestPanel } from "./TestPanel.js";
import type { ArenaTransport } from "../arena/transport.js";
import type { CollabClient } from "../arena/collab.js";
import type { ArenaSnapshot } from "../arena/types.js";

function isRevisionApproved(snapshot: ArenaSnapshot): boolean {
  if (snapshot.docRevision === null) return true;
  return (
    snapshot.readyRevision?.you === snapshot.docRevision &&
    snapshot.readyRevision?.mate === snapshot.docRevision
  );
}

function isReadyGateApproved(snapshot: ArenaSnapshot): boolean {
  if (snapshot.mode !== "2v2") return true;
  return Boolean(snapshot.ready.you && snapshot.ready.mate && isRevisionApproved(snapshot));
}

function isCollabLive(collab?: CollabClient | null): boolean {
  return !collab || collab.connection() === "connected";
}

function isEditable(snapshot: ArenaSnapshot, collab?: CollabClient | null): boolean {
  const canEditBase = snapshot.roundPhase === "CODING" && snapshot.you.status === "coding";
  if (!canEditBase) return false;
  return isCollabLive(collab) && (!collab || collab.recoverySource === null);
}

function isCollabSynced(snapshot: ArenaSnapshot, collab?: CollabClient | null): boolean {
  if (!collab) return true;
  return (
    !collab.hasPendingUpdates &&
    collab.revision === snapshot.docRevision &&
    collab.language === snapshot.language
  );
}

function resolveSubmitHint(snapshot: ArenaSnapshot, readyGate: boolean): string {
  if (snapshot.mode === "2v2" && !readyGate) {
    return "Team submit needs both teammates ready.";
  }
  return snapshot.you.status === "coding" ? "" : `You are ${snapshot.you.status}.`;
}

function confirmResubmitIfNeeded(snapshot: ArenaSnapshot): boolean {
  const hasSubmitted = snapshot.you.submissions > 0 || snapshot.alpha.submissions > 0;
  if (!hasSubmitted) return true;
  return window.confirm("Submitting again replaces your current scored result for this round. Continue?");
}

function resolveEditorKey(snapshot: ArenaSnapshot, collab?: CollabClient | null): string {
  if (collab) {
    return `collab-${snapshot.round}-${collab.doc.clientID}`;
  }
  return "local";
}

function UnsavedEditRecovery({
  recoverySource,
  onDismiss,
  onError,
}: {
  recoverySource: string;
  onDismiss: () => void;
  onError: (msg: string) => void;
}) {
  const handleCopy = () => {
    if (!navigator.clipboard) {
      onError("Select the recovery text and copy it manually.");
      return;
    }
    void navigator.clipboard
      .writeText(recoverySource)
      .catch(() => onError("Select the recovery text and copy it manually."));
  };

  return (
    <section aria-label="Unsaved edit recovery" className="space-y-2 border-b border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs">Your unconfirmed text is kept here. Copy it, then dismiss this copy to resume editing.</p>
      <textarea aria-label="Recovery text" readOnly value={recoverySource} className="h-24 w-full rounded border border-neutral-300 bg-white p-2 font-mono text-xs" />
      <div className="flex gap-2">
        <button type="button" className="rounded border border-neutral-300 px-2 py-1 text-xs" onClick={handleCopy}>
          Copy recovery text
        </button>
        <button type="button" className="rounded border border-neutral-300 px-2 py-1 text-xs" onClick={onDismiss}>
          Dismiss recovery copy
        </button>
      </div>
    </section>
  );
}

function CollabStatusBanner({ collab }: { collab: CollabClient }) {
  const isConnected = collab.connection() === "connected";
  const message = isConnected
    ? `Shared doc r${collab.revision ?? "?"} · live — actions wait for saved changes.`
    : "Shared doc reconnecting — editing paused until synced.";

  return (
    <>
      <p role="status" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-neutral-600">
        {message}
      </p>
      {collab.error && (
        <p role="alert" className="border-b border-neutral-200 px-3 py-1 text-xs text-red-700">
          {collab.error}
        </p>
      )}
    </>
  );
}

function useAsyncGuard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guard = async (fn: () => Promise<unknown>, action: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, setError, guard };
}

function WorkspaceToolbar({
  snapshot,
  transport,
  canEdit,
  canSubmit,
  connected,
  sharedActionsReady,
  busy,
  readyGate,
  liveCode,
  guard,
  setFontSize,
  setError,
}: {
  snapshot: ArenaSnapshot;
  transport: ArenaTransport;
  canEdit: boolean;
  canSubmit: boolean;
  connected: boolean;
  sharedActionsReady: boolean;
  busy: boolean;
  readyGate: boolean;
  liveCode: string;
  guard: (fn: () => Promise<unknown>, action: string) => Promise<void>;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  setError: (err: string | null) => void;
}) {
  const isTeam = snapshot.mode === "2v2";
  const canEditToolbar = canEdit && connected && sharedActionsReady;
  const isToolbarBusy = busy || !sharedActionsReady;

  const handleSubmit = () => {
    if (!confirmResubmitIfNeeded(snapshot)) return;
    void guard(
      () =>
        transport.submit({
          code: liveCode,
          language: snapshot.language,
          documentRevision: snapshot.docRevision ?? undefined,
        }),
      "Submit"
    );
  };

  const handleLanguage = (l: string) => {
    transport.setLanguage(l).catch((e: unknown) => setError(e instanceof Error ? e.message : "language switch failed"));
  };

  return (
    <EditorToolbar
      language={snapshot.language}
      languages={Object.keys(snapshot.problem.starters)}
      canEdit={canEditToolbar}
      canSubmit={canSubmit}
      busy={isToolbarBusy}
      connected={connected}
      isTeam={isTeam}
      submitHint={resolveSubmitHint(snapshot, readyGate)}
      onLanguage={handleLanguage}
      onFontBigger={() => setFontSize((f) => Math.min(20, f + 1))}
      onFontSmaller={() => setFontSize((f) => Math.max(10, f - 1))}
      onRun={() => void guard(() => transport.run({ code: liveCode, language: snapshot.language }), "Run")}
      onSubmit={handleSubmit}
    />
  );
}

export function CodeWorkspace({
  snapshot,
  transport,
  code,
  onCode,
  collab,
}: {
  snapshot: ArenaSnapshot;
  transport: ArenaTransport;
  code: string;
  onCode: (code: string) => void;
  /** 2v2 live only: team Y.Doc provider. Absent = local document (1v1/mock). */
  collab?: CollabClient | null;
}) {
  const editorRef = useRef<EditorAdapterHandle>(null);
  const [fontSize, setFontSize] = useState(13);
  const { busy, error, setError, guard } = useAsyncGuard();

  const canEdit = isEditable(snapshot, collab);
  const readyGate = isReadyGateApproved(snapshot);
  const sharedActionsReady = isCollabSynced(snapshot, collab);
  const connected = transport.connection() === "connected" && isCollabLive(collab);
  const canSubmit = canEdit && readyGate;
  const liveCode = collab ? collab.getSource() : code;
  const recoverySource = collab?.recoverySource;

  return (
    <section aria-label="Code workspace" className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <WorkspaceToolbar
        snapshot={snapshot}
        transport={transport}
        canEdit={canEdit}
        canSubmit={canSubmit}
        connected={connected}
        sharedActionsReady={sharedActionsReady}
        busy={busy}
        readyGate={readyGate}
        liveCode={liveCode}
        guard={guard}
        setFontSize={setFontSize}
        setError={setError}
      />
      {collab && <CollabStatusBanner collab={collab} />}
      {recoverySource && (
        <UnsavedEditRecovery
          recoverySource={recoverySource}
          onDismiss={() => collab.clearRecovery()}
          onError={setError}
        />
      )}
      {error && (
        <p role="alert" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="p-3">
        <EditorAdapter
          key={resolveEditorKey(snapshot, collab)}
          ref={editorRef}
          language={snapshot.language}
          code={code}
          readOnly={!canEdit}
          fontSize={fontSize}
          onChange={onCode}
          collab={collab ?? undefined}
        />
      </div>
      <TestPanel tests={snapshot.tests} />
    </section>
  );
}
