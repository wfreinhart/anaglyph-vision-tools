# UI failure log — puzzle.html

Each entry: environment, steps, observed vs expected, evidence, status.
"Emulated" = Playwright WebKit (touch, 1024x768 @2x) on the MacBook Air. Not the same as verified on the iPad.

## F1. The parked settings sheet paints a grey band over the bottom of the field
- **Env:** emulated, WebKit 1024x768, Pop! mode (dock hidden). Present in every mode.
- **Steps:** load `puzzle.html#pop`, screenshot.
- **Observed:** grey gradient along the bottom ~60px of the white field. **Expected:** pure field colour.
- **Cause (confirmed from CSS):** `#panel` is parked at `translateY(102%)` but kept `box-shadow:0 -20px 50px`, which reaches up into the viewport.
- **Clinical impact:** binocular non-field paint behind targets near the bottom edge (Touch-it / Sort placement, or any mode with child lock on, where bottomClear drops to 12px).
- **Status:** fixed (shadow only on `#panel.on`); re-screenshot pending.

## Hypotheses to reproduce (not yet confirmed)
- **H3. Tap mode scores on `pointerup` at the target.** A finger that lands on a target and slides off loses the tap. Low severity.
- **H4. Any resize still rebuilds the round** (after the drag ends), losing a half-built jigsaw. On iOS this fires on rotation; in Safari (not home-screen mode) possibly on toolbar show/hide. Needs an iPad check of how often it fires before deciding between "relayout in place" and leaving it.

## F2. A `#pop` link does nothing in an already-open tab
- **Env:** emulated, WebKit. **Steps:** open `puzzle.html`, then navigate to `puzzle.html#pop`.
- **Observed:** mode stays Jigsaw (fragment-only navigation does not reload; `#pop` was read only at load). **Expected:** Pop! starts.
- **Status:** fixed (`hashchange` handler). Same script: mode = pop without a reload.

## F3. A resize mid-drag kills every drag until reload (confirmed H1 + H2)
- **Env:** emulated, Chromium with CDP touch input (browser-generated pointer events, real capture/routing), 1024x768 → 1024x700 mid-drag. WebKit with synthetic events showed the vanish but not the stuck state, because synthetic routing sent the release to the removed piece.
- **Steps:** Jigsaw; touch a piece and move it; resize the viewport; keep moving; release; try to drag any piece.
- **Observed:** the held piece vanishes (`newRound` rebuilt the board 220 ms after resize, ignoring the drag); afterwards **no piece can be dragged** — `drag` stayed set because the release landed on the new board, which has no drop listener, so `onGrab` returned early forever. **Expected:** drag continues; later drags work.
- **iPad trigger (inferred, not yet observed):** rotation, Split View/Slide Over, Safari toolbar resize.
- **Fix:** `newRound` releases any held drag; resize rebuild waits until no piece is held. Same script after the fix: all four drags move normally, no errors.
