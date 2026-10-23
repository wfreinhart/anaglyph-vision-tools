# CONTEXT — eyetrainer pair

## Current Task
Maze mode in puzzle.html (relayed task 2026-10-22, spec docs/maze.md) — built, tested on the Air, committed; waiting on Wes's iPad check and his answer on what "colors" means.

## Key Decisions
(full record in INTENT.md)
- Everything in a maze (walls, mover, goal, trail, solution) is in the round's eye via `mazeInks(eye)` (inkFor/rampInk only). "Colors" = same-eye looks (trail line/light/dots, wall full/medium) — my interpretation, unconfirmed with Wes. Other-eye trail not built (doesn't force fusion).
- Either character can be dragged; solved when the two trails join (Wes 2026-10-22, verbatim in INTENT.md).
- Maze wins tick the HUD tally but are counted apart from right/wrong (`state.mazeWins`) and are not written to the per-eye ms log (support). Per-eye maze log = backlog.
- Earlier character-art decisions: see INTENT.md / git log (toned .t1/.t2 art, packs, `#pop`).

**State:** maze pushed to GitHub Pages 2026-10-23 (Wes: "Can you get the maze deployed to the gh IO page"; e15c3d1 live at wfreinhart.github.io/anaglyph-vision-tools/puzzle.html#maze). The jigsaw `.cellrim` full-ink slot outline (2026-10-14) is parked as docs/pending-cellrim.patch (untracked; `git apply` it) so the iPad demo serves only committed code — passes optics_test/verify on the Air, no browser check yet.
**Tests (Air only):** rsync puzzle.html eye-trainer.html optics_test.js verify.py index.html webkit_smoke.js maze_realdrag.js to air:tmp/rgtest; `node optics_test.js`, `python3 verify.py`, `node webkit_smoke.js`, `node maze_realdrag.js`. Playwright 1.61.0 installed in ~/tmp/rgtest on the Air (matches cached webkit-2311). 2026-10-22: 179/0, PASS, 120/0, real-input drags OK — all emulated.

**Open threads**
- Wes: what "different colors" means (same-eye looks vs other-eye trail); iPad calibration + cover-one-eye on the maze; answered by drag-either; 8×8 and medium-wall visibility.
- Older card c-1fce19 (Pop "doesn't use both eyes", 30% tone visibility, custom packs) still unanswered.
- Backlog: per-eye maze log; stats line says "No taps yet today" if only mazes were played.

## Next Steps
- Hand the maze to Wes; act on his iPad check and colour answer.
- Browser-check and commit (or drop) the jigsaw `.cellrim` change.

Last saved: 2026-10-22.
- 2026-10-22 Wes: "consider ways to makw both eyes work at once" — proposed (not built): split-wall "Two-eye maze (experimental)" switch, off by default, each eye's view checked to be ambiguous alone; framed as a two-eye information task, not fusion; doctor review because of exotropia misalignment. Awaiting his yes/no.
