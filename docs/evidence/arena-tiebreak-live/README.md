# Authoritative tie-break winner display

2026-11-13, disposable real match850b8e4e-d405-4f60-aba1-2886ddd34557. Real HTTP final returned scores left125/right125, outcomeleft, winnerleft. The fresh Chrome view for Beta correctly selected Python for the snippet problem, but initially reported a draw.

The frontend had recomputed the result from score totals and discarded the authoritative winner. The scoped fix uses the server winner, keeping equal totals and existing forfeit wording. A public transport snapshot regression failed before the repair and passed after it for both viewer perspectives and a null-winner draw. Client95tests, lint and production build with TypeScript pass; both review axes have no findings.

[Before repair](01-before-tiebreak-display-fix.png) is diagnostic evidence of the wrong message, not a correct book result. Original-resolution captures are3456×2166 with no resize or crop. The completed match reload is a UI result/default check; gameplay in this post-fix match was exercised through real authenticated HTTP, not repeated entirely through the browser.

[After repair](02-after-authoritative-winner.png): the same real match reloaded in Chrome shows Opponent wins the match for Beta, matching serverwinnerleft. Python remains selected. The image was visually inspected at original resolution.
