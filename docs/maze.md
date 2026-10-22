# Maze mode — spec (2026-10-22)

Source: launch note relayed by the hub (card eyetrainer/20261022T132059-46825). Wes's ask as relayed:
"various maze options with colors; a toggle to show/hide the solution; optionally the solution slowly
draws itself, animated. Purpose: give Leo options to trace through the maze with different colors as a
new red/green localization activity." Verbatim original not checked; this is the relay's wording.

## What Leo does
A maze appears in one eye's ink. A pack character (the mover) sits at the start, another (the goal)
at the exit. He drags the mover along the corridors; a trail follows. Reaching the goal plays the
usual binocular reward, then the next maze (eye flips under Alternate).

## Optics rules (non-negotiable; INTENT.md Limits)
- Walls, start, goal, mover, trail and solution are ALL in the round's eye (`state.curEye`), drawn
  with `inkFor(eye)` / `rampInk(eye, t)`. Eye plan Both → `inkFor('both')` (warm-up, no training value).
- No field-coloured masks, halos, hit-area chrome, shadows, filters, blend modes, opacity, or a
  binocular border/frame anywhere on the play surface. Hit areas are invisible (no fill or
  `fill="none"` with pointer handling on the field/svg, not painted rects).
- Reward may be binocular only after the goal is reached.
- The solution always stays in the maze's eye (an other-eye solution or trail would change the
  clinical task: not built; see "Not built").
- Every colour the maze draws must come from one function (e.g. `mazeInks(eye)`) so the tests can
  lift and check it.

## Options (settings rows shown only in Maze mode)
- **Maze size:** 3×3 (default), 4×4, 6×6, 8×8. 8×8 is untested for finger size on the iPad.
- **Trail look** (appearance only, same eye): Line (full ink) / Light line (ramp 0.6) / Dots
  (full ink, round-cap dashes). Labelled as looks, not colours — the calibrated inks are not a palette.
- **Wall tone:** Full (default) / Medium (ramp 0.6). Lighter tones only after an iPad visibility check.
- **Show the way** toggle (off by default): the solution path through cell centres, ramp tone ~0.45,
  narrower than the corridor so it never touches walls.
- **Draw it slowly** toggle (on by default when Show the way is on): the solution reveals itself
  start→goal via stroke-dashoffset over roughly 0.5 s per cell. Same colour throughout the animation.
- Character packs feed the mover and goal (shapePool()).

## Generator and traversal
- Perfect maze (recursive backtracker) on an n×n grid with a seeded PRNG: every cell reachable,
  exactly n²−1 passages, unique solution. Start top-left, goal bottom-right (or opposite corners at random).
- Trail snaps cell to cell. Pointer moves are sampled along the segment from the last point at
  ≤ ¼-cell steps, so a fast drag walks each open passage in order and stops at a wall; it never jumps.
  Moving back onto the previous trail cell retracts the trail.
- pointercancel, release, resize, orientation change and mode change leave the maze recoverable
  (mover at the trail head, ready to be grabbed again; reuse the existing drag lifecycle / abortDrag).

## Done means
1. `node optics_test.js` passes with a new maze suite: generator (perfect, connected, unique
   solution, many seeds and all sizes), traversal (fast drag never crosses a wall; backtrack retracts),
   and inks (every `mazeInks` colour equals `rampInk`/`inkFor` for the round's eye and keeps the ink's
   ghost ratio). No existing test weakened; measured values unchanged.
2. `python3 verify.py` PASS with the new ids registered.
3. Playwright WebKit with touch on the Air (labelled "emulated"): every stroke/fill rendered inside
   the field is on the round eye's ramp; a fast swipe does not cross walls; backtracking; solution
   toggle and animation; completion fires the reward; pointercancel/resize recover.
4. Acceptance (Wes, real iPad): calibration + cover-one-eye check on the maze; a 3×3 round Leo
   traces without coaching.

## Not built (needs Wes / separate design)
- Trail or solution in the OTHER eye (dichoptic). It does not make fusion necessary (one eye can
  still solve the maze from walls + mover + goal), so it is not a "Both eyes needed" variant.
- Real colour choice beyond the two calibrated inks and their tones.
