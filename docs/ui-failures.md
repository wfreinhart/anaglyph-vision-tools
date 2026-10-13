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
- **H1. A resize mid-drag rebuilds the round.** `window.resize` → `newRound()` after 220 ms with no drag check. iOS Safari fires resize when its toolbar shows or hides, which can happen during a drag. Expected symptom: the piece vanishes from under the finger. Repro plan: emulated drag + `setViewportSize` mid-drag; confirm on the iPad.
- **H2. No `lostpointercapture` handler.** If capture is lost without `pointerup`/`pointercancel`, `drag` stays set, `onGrab` returns early forever, and nothing can be picked up until a reload. Repro plan: dispatch `lostpointercapture` mid-drag in emulation.
- **H3. Tap mode scores on `pointerup` at the target.** A finger that lands on a target and slides off loses the tap. Low severity.
