import { DuelPanel } from "./DuelPanel.js";
import { TeamChat } from "./TeamChat.js";
import { TeamPanel } from "./TeamPanel.js";
import type { TeamChatClient } from "../arena/chat.js";
import type { ArenaSnapshot } from "../arena/types.js";

export function MatchPanel({
  snapshot,
  onSetReady,
  chat,
  readyDisabled,
}: {
  snapshot: ArenaSnapshot;
  onSetReady: (value: boolean) => void;
  chat?: TeamChatClient | null;
  readyDisabled?: boolean;
}) {
  if (snapshot.mode === "2v2") {
    return (
      <div className="space-y-3">
        <TeamPanel alpha={snapshot.alpha} beta={snapshot.beta} ready={snapshot.ready} onSetReady={onSetReady} disabled={readyDisabled} />
        <TeamChat client={chat} readOnly={snapshot.roundPhase === "MATCH_COMPLETE"} />
      </div>
    );
  }
  return <DuelPanel you={snapshot.you} opponent={snapshot.opponent} />;
}
