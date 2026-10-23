# Two-colour mazes (experimental) — spec (2026-10-23)

Source: Wes, lead pane, 2026-10-23, verbatim: "Then let's get the duo tone modes in"; asked what he
meant, he multi-selected "Other-colour trail", "Split walls", "Characters vs walls". Design reviewed
by the support seat (2026-10-23); its corrections are folded in below.

These change which eye sees what, so they are clinical behaviour: experimental, never the default,
and flagged for the doctor with their actual eye assignments and no treatment claim. Split walls is a
*two-eye information design*: it needs what both eyes see, not both eyes at the same instant, and it is
not a fusion or suppression test (bumping into walls allows trial and error).

## The chooser
A **Colours** row in Maze settings: One colour (default) / Trail in other colour / Split walls /
Characters vs walls; the three are labelled experimental with a one-line description each.
- One `mazeColours` state field, **reset to One colour on every page load and whenever Maze is
  entered from another mode**. Never restored from storage; never silently re-activated (e.g. after
  switching the eye plan away from Both). The choice holds for successive mazes within the visit.
- Eye plan Both: the chooser is disabled (shown, with why) and play is One colour.

## Eye assignment (X = the round's eye, alternating per maze as now; Y = the other eye)
| Mode | X | Y |
|---|---|---|
| One colour | everything | — |
| Trail in other colour | walls, characters, solution | both trails |
| Characters vs walls | walls | characters, both trails |
| Split walls | characters, both trails | — ; walls split between X and Y |

All colours still come from `mazeInks` (extended to take the mode / both eyes), built only from
`inkFor` / `rampInk`.

## Rules from the support review
- **Show the way is disabled in Split walls and Characters vs walls** (shown disabled with the
  reason): in Split walls it hands one eye the route; in Characters vs walls the X-ink line runs under
  Y-ink characters, which occlude it and reveal their positions to X.
- **Trail in other colour — delayed trail.** A live Y trail ending under the X character would show Y
  where the character is (a wrong-eye position cue near the thing he acts on). The Y trail stops at
  least one cell (along the path) behind its character and never passes under either character.
  It still traces his route, so the doctor note says plainly that this variant carries an intentional
  experimental cue and is not a clean one-eye localisation task.
- **Split walls ambiguity.** Assign every wall segment (outer border included, so there is no
  binocular frame) to X or Y. Accept a split only if the combined walls give the unique route (they
  do, it is the same maze) AND, for each eye alone, several junctions on or next to the true route
  show a plausible false continuation that only the *other* eye's wall closes — with false choices
  contributed by both eyes (suggested: ≥ 2 per eye at 3×3, scaling with n; one named constant).
  Regeneration is bounded (fixed attempt cap, then fall back to the best split found and record that).
- **No mixed joins.** Opposite-eye wall strokes never touch: leave a gap at every corner or T where
  an X segment meets a Y segment (butt caps, inset ends), so antialiasing never mixes the two inks or
  makes a binocular junction mark.
- **Clearance.** The moving character's painted bounds never overlap any wall of either eye.

## Done means
1. optics_test: per mode, every colour equals inkFor/rampInk of its assigned eye (table above);
   ambiguity check over many seeds and all sizes; the split partition's walls union to the maze;
   no solution path in the two disabled modes; reset rules (sanitize never restores mazeColours).
2. webkit_smoke (emulated): rendered paints per element on the assigned eye's ramp for every mode;
   pixel audit at split-wall joins and the border (no pixel off both ramps); Y trail never within one
   cell of either character; character clearance from both eyes' walls; effective settings after
   reload and after a mode change and back (One colour); Show the way disabled where specified.
3. verify.py PASS; maze_realdrag still passes in every mode.
4. Acceptance on the iPad: calibrate, cover each eye in each mode; doctor note in
   docs/training-mechanism.md.
