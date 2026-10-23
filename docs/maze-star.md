# Maze power-up star — spec (2026-10-23)

Source: Wes, lead pane, 2026-10-23, verbatim: "For the Mario themed mazes I also want occasional
"power up star" that activates the rainbow mode and plays music like the star in Mario kart".
Design reviewed by the support seat (2026-10-23). Builds after continuous movement and the
two-colour mazes (docs/maze-duo.md).

## Behaviour
- Only when a Mario pack (`kingdom` or `kingdomitems`) is on. Roughly one maze in three (one named
  constant) places a star pickup on an **interior cell of the solution route**, so he is likely to
  meet it. Off-route detours are a later option.
- Collected once, when either character's rail position reaches it — through fast swipes and on
  `pointerup` too; never through a wall, never on `pointercancel`.
- **Star power** (~8 s, one constant): an original fast WebAudio jingle in the spirit of the kart star
  (no audio files; not the actual melody). Respects the sound setting; scheduled notes stop when star
  power ends, the maze ends, the mode changes, or the page hides.
- **During play the "rainbow" is a same-eye shimmer:** the powered character keeps its full-ink
  silhouette; only its tone details (`.t1/.t2` parts) glide continuously along that eye's ramp. No hue
  cycle, no abrupt pulses, nothing that flashes. `prefers-reduced-motion`: a steady powered look.
- **Win while powered:** the post-win celebration becomes a small fixed multicolour (rainbow) burst at
  the meeting point — binocular is allowed after success — no full-screen flash, and it clears before
  the next maze appears.

## Eyes
The star is full ink in the same eye as the characters: X in One colour, Trail in other colour and
Split walls; Y in Characters vs walls. It stays clear of opposite-eye walls and trails. In Split walls,
its placement and art must not reveal the route to X or weaken the ambiguity check.

## Done means
optics_test: star colour = inkFor of the characters' eye in every mode; shimmer tones on that ramp;
collection exactly once along rails (swipe, release; not cancel; not through walls); only with Mario
packs. webkit_smoke (emulated): rendered audit during star power (every paint on the assigned ramp;
rainbow colours only after the win and gone before the next maze); sound stops on hide/mode change;
reduced motion steady. iPad: cover-eye check with star power on.

## As built (2026-10-23)
Constants live in `MAZE` (puzzle.html): `starChance` 1/3, `starReach` 0.3 cell, `starSecs` 8, `starSize` 0.5 cell,
`shimmerSecs` 4, `shimmerLo/Hi` 0.25/0.85, `steady` [0.8, 0.35], `beat` 0.11 s, `tune`.
- **Placement** (`mazeStarPlan`, pure, from the maze seed): only if `mazeStarWanted(state.packs)`. On an
  interior route cell chosen uniformly. In Split walls the star is X ink, so X learns that cell is on the route:
  `mazeSplitScore(maze, segs, assign, star)` re-counts X's false branches with that cell known (a branch before the star
  only counts if it returns no later than the star and never goes past it), and the star is placed only on a cell where
  X still has at least `need` of them; never in a split that already failed. Y's count is unaffected.
- **Clearance:** the star is 0.5 cell, narrower than a character (0.62), at a cell centre, so it clears walls as a character
  does. In Trail in other colour the cut trail stays at least a cell behind its tip and the star is taken when the tip is within
  0.3 cell, so the other-eye trail is at least 0.7 cell from an untaken star (tested: closest 1.00).
- **Collection** (`mazeStarSlide`): a `mazeSlide` whose per-sample callback tests the tip's distance to the star along the rails
  (`mazeGap`, never straight through a wall); `starReach` x 2 exceeds a slide step so a sample cannot skip it. `got` is latched.
  Release goes through the same `mazeMove`; `pointercancel` never moves or scores.
- **Shimmer:** while powered the character's element gets class `powered` and `--sh1/--sh2`, set by `mazeStarTones` to
  `rampInk(eye, t)` for two slow sines half a turn apart in [0.25, 0.85]; CSS `.mzchar.powered .t1/.t2{fill:var(--shN)}`.
  The silhouette is untouched. Under `prefers-reduced-motion` the tones sit at `steady` and no animation loop runs. A character
  with no `.t1/.t2` parts (Mario Items shapes) shows no shimmer, only the music.
- **Sound** (`starSoundStart/Stop`): own oscillators, scheduled 0.35 s ahead every 100 ms, each tracked; stopped (30 ms fade) on
  time, win, new round (mode or colour change, leaving Maze), page hide, `pagehide`, and when the sound setting goes off.
  The tune is a bouncing C-pentatonic run (never the same note twice in a row, a bass note every fourth beat), not the kart theme.
- **Win while powered:** power ends; `celebrate(at, true)` makes 12 fixed 30px stars in six fixed colours (`RAINBOW`, the only
  colour literals outside the ramp), removed after 1.0 s and swept by `newRound` (1.4 s).
- Test hook: `window.mazeStarForce` (1 always, 0 never; tests only). Data attributes `data-star` (cell or -1) and
  `data-star-state` (none / waiting / power / spent).
