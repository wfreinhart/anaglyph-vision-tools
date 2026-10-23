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
