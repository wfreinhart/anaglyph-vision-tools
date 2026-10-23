# Maze mode — spec (2026-10-22)

Source: launch note relayed by the hub (card eyetrainer/20261022T132059-46825). Wes's ask as relayed:
"various maze options with colors; a toggle to show/hide the solution; optionally the solution slowly
draws itself, animated. Purpose: give Leo options to trace through the maze with different colors as a
new red/green localization activity." Verbatim original not checked; this is the relay's wording.

## What Leo does
A maze appears in one eye's ink. Two pack characters sit in opposite corners, drawn exactly alike
(full ink, the round's eye), so there is no "goal" piece and no "draggable" piece: he can drag either.
Each leaves its own trail from its own corner. When the two characters meet, the usual binocular reward
plays, then the next maze (eye flips under Alternate).

Decision 2026-10-22 (Wes, directly): "let us drag either shape because right now there's no obvious goal
vs draggable". This replaces the first spec's fixed mover and goal.

## Optics rules (non-negotiable; INTENT.md Limits)
- Walls, both characters, both trails and solution are ALL in the round's eye (`state.curEye`), drawn
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
- Character packs feed both characters (shapePool()).

## Generator and traversal
- Perfect maze (recursive backtracker) on an n×n grid with a seeded PRNG: every cell reachable,
  exactly n²−1 passages, unique solution. The characters start in opposite corners (`maze.start` and
  `maze.goal`, still the ends of the solution path, which "Show the way" and "Draw it slowly" draw
  unchanged).
- Movement is CONTINUOUS (Wes, 2026-10-23: "make the movement in the maze continuous instead of
  discrete"; supersedes the old cell-to-cell snapping). Design: rails. A character (a "walker") is
  `{ trail, nx, f }`: `trail` the cells it has fully passed (head last), `nx` the neighbour its tip is
  sliding toward (-1 at rest) and `f` 0..1 how far along head→nx. It only ever sits on an open edge
  between two cell centres, so it slides along the corridor centre lines and cannot leave them. Its
  drawn trail is the polyline through the passed cell centres plus the part-way tip; it grows and retracts
  smoothly (going back over the cell before the head pops it and leaves the tip on that edge). Positions
  are stored in cell units (cells + fraction), so a resize or rotation keeps them.
- Following the finger is LOCAL (`mazePursue`). Each pointer sample is cut into ≤ ¼-cell sub-samples
  (`MAZE.sub`), so a fast flick is followed as closely as a slow drag. For each sub-sample only the open arms
  of the cell the character is nearest to are considered (an arm runs from that cell's centre to the
  neighbour's centre); the character slides, at most `MAZE.step` (½ cell) per sub-sample, toward the point of
  the best-fitting arm (the nearest point on an arm to the finger). It never snaps to the globally nearest
  segment, so a finger in the parallel corridor beyond a wall cannot carry it across.
  Turn choice at a junction is that same rule: the arm with the smallest distance to the finger wins, with
  two head starts so a sloppy fingertip does not wander into side passages: the arm the character is already
  on gets `MAZE.hold` (0.12 cell) and the straight way on gets `MAZE.ahead` (0.2 cell). A finger past a dead
  end or a wall leaves the character at the nearest rail point. A press keeps its offset from the character
  (no jump on pick-up). On release the character settles on the final finger point (`settle`); otherwise a
  finger that lands far from it is caught up with gradually (≤ ½ cell per sub-sample).
- Grab: pressing within 0.8 cell (`MAZE.grab`) of either character takes that one (the nearer if both are in
  range); the other stays put. Anywhere else grabs nothing.
- Meeting: the maze is solved when the two characters meet, i.e. the distance ALONG THE CORRIDORS between
  them (`mazeGap`, a graph distance in cells, not screen distance) is ≤ `MAZE.meet` (0.5 cell). So it can
  never fire across a wall (characters either side of a wall are at least 3 cells apart, the way round).
  A character on or crossing the other's trail body has not met it; only the characters count, and
  retracting toward the other can meet too. The slide stops at the sub-sample where the gap reaches the
  threshold; the reward fires between the two characters, which then overlap slightly (the pieces are 0.62
  cell wide).
- Release: `pointerup` first slides to the final pointer position exactly like a move (a finger whose
  release lands on the meeting wins), with settling, then releases if that did not already win.
  `pointercancel` and `lostpointercapture` (and the stray-release backstops) never move or score; they
  just release.
- pointercancel, release, resize, orientation change and mode change leave the maze recoverable (both
  walkers kept, ready to be grabbed again; reuse the existing drag lifecycle / abortDrag). The svg carries
  `data-trail-a` / `data-trail-b` (the passed cells) and `data-pos-a` / `data-pos-b` (`head,next,fraction`) so
  tests can read both.
- Optics/paint margin: the piece is 0.62 cell (never more than 0.8 cell minus the wall width, for tiny
  cells), so centred on a corridor it clears the painted wall edge by about 0.14 cell. Checked in WebKit at
  8×8 on 1024×768 and 768×1024: the character's bounding box never overlaps a wall rectangle at any sampled
  position.
- The pure functions (`mazeWalker`, `mazePoint`, `mazePursue`, `mazeSlide`, `mazeGap`, `mazeJoined`, and the
  `MAZE` tuning constants) touch no DOM and no state, so optics_test.js lifts them (`braceBlock`) and proves
  them. They replace the old `mazeWalk`.

## Done means
1. `node optics_test.js` passes with a new maze suite: generator (perfect, connected, unique
   solution, many seeds and all sizes), rails (every intermediate position on an open edge and joined to the
   last; hostile fingers, flicks through walls, a finger running across a wall into a parallel corridor,
   wobbly and straight following, smooth growth and retraction, gradual catch-up and settling), gap and meeting
   (graph distance, side-by-side across a wall is the way round, meets exactly at 0.5 cell, standing on the
   other's trail does not meet, never through a wall), and inks (every `mazeInks` colour equals
   `rampInk`/`inkFor` for the round's eye and keeps the ink's ghost ratio). No existing test weakened;
   measured values unchanged.
2. `python3 verify.py` PASS with the new ids registered.
3. Playwright WebKit with touch on the Air (labelled "emulated"): every stroke/fill rendered inside
   the field is on the round eye's ramp, including at sampled positions mid-drag; a fast swipe does not cross
   walls; sampled positions during smooth drags from both characters at 8×8 on both orientations are on open
   edges, drawn where the model says and never over a wall; backtracking; solution toggle and animation;
   completion fires the reward; pointercancel/resize recover. maze_realdrag.js drives hit-tested mouse drags
   from both characters on smooth wobbling paths.
4. Acceptance (Wes, real iPad): calibration + cover-one-eye check on the maze; a 3×3 round Leo
   traces without coaching, and drags either character without asking which one moves.

## Not built (needs Wes / separate design)
- Trail or solution in the OTHER eye (dichoptic): the experimental two-colour modes now do put the trail in the other eye (docs/maze-duo.md); the way (solution) never leaves the round's eye.
- (Original note:) Trail or solution in the OTHER eye (dichoptic). It does not make fusion necessary (one eye can
  still solve the maze from walls + both characters), so it is not a "Both eyes needed" variant.
- Real colour choice beyond the two calibrated inks and their tones.
