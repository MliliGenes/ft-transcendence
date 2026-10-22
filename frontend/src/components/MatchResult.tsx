import type { MatchFinalView, RevealView } from "../arena/types.js";

export function MatchResult({
  reveal,
  round,
  matchFinal,
}: {
  reveal: RevealView | null;
  round: number;
  matchFinal?: MatchFinalView | null;
}) {
  const totals = matchFinal ?? reveal?.totals;
  if (!totals) return null;
  const { you, opponent } = totals;
  const outcome =
    matchFinal?.outcome ??
    (you > opponent
      ? "You win the match."
      : you < opponent
        ? "Opponent wins the match."
        : "The match is a draw.");
  return (
    <section aria-label="Match result" className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <h2 className="text-sm font-semibold">
        {reveal ? <>Match complete after {round} round{round === 1 ? "" : "s"}</> : "Match complete"}
      </h2>
      <p className="font-mono text-xs text-neutral-700" role="status">
        Final — you {you} · opponent {opponent}. {outcome}
      </p>
    </section>
  );
}
