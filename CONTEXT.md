# CONTEXT — eyetrainer pair

## Current Task
Maze mode for Leo (relayed task 2026-10-22 + Wes's follow-ups) — done and live on Pages (3000372, wfreinhart.github.io/anaglyph-vision-tools/puzzle.html#maze); awaiting Wes's iPad playtest.

## Key Decisions
(full record with Wes's verbatim words in INTENT.md; specs docs/maze.md, maze-duo.md, maze-star.md)
- Default maze is one eye's ink (mazeInks); continuous rail movement; either character drags, win when they meet (corridor gap ≤ 0.5).
- Two-colour modes (trail / split walls / characters vs walls) experimental, reset to One colour each load, Show the way off in them; doctor note docs/training-mechanism.md §7.
- Mario power-up star: same-eye shimmer + original jingle; rainbow only after a win.

**State:** all pushed (Wes 2026-10-23: "just get it deployed it gh.io asap and close out"). Parked, untracked: docs/pending-cellrim.patch (jigsaw slot outline, no browser check) and docs/pending-ratio-checks.patch (unfinished test-only fix, see below).
**Tests (Air only):** rsync puzzle.html eye-trainer.html optics_test.js verify.py index.html webkit_smoke.js maze_realdrag.js to air:tmp/rgtest; node optics_test.js (325/0), python3 verify.py, node webkit_smoke.js (559/0), node maze_realdrag.js. Playwright 1.61.0 in ~/tmp/rgtest. All emulated.

## Next Steps
- Wes: iPad calibration + cover-each-eye per mode (and with star power); Leo's 3×3 playtest; 8×8 / medium-wall visibility.
- Finish the ratio-check fix (support 2026-10-23): some older ghost-ratio loops compare non-finite ratios and never fire — require finite values, count valid cases; partial attempt in docs/pending-ratio-checks.patch, untested.
- Old card c-1fce19 (Pop questions) still unanswered; per-eye maze log is backlog.

Last saved: 2026-10-23.
