# Training mechanism — proposals for Wes and the doctor

The optics model, the measured inks, and the clinical defaults (white field, strict L/R alternation, fusion off) are unchanged. Everything below that would change *what the eyes are asked to do* is a proposal for the doctor. Nothing here is built except item 1, which only records data.

Patient context (from AUDIT_BRIEF): age 3, exotropia, **left eye turns out**, right eye normal. Which eye wears the red lens is configurable.

## 1. Per-eye "floated away" count in Pop! — built, measurement only
Pop! is the cleanest trial in the app: one target, one eye, a known appearance time. So its numbers mean something:
- **avg time** in Pop! is real time from appearance to touch (unlike Jigsaw/Blocks, where it is the interval between placements; see AUDIT_CODEX).
- **floated away** (new, per eye) counts targets he never touched before they left.

If the left-eye targets float away much more often than the right-eye ones, or take much longer to tap, that is the clearest sign of left-eye suppression the app can produce. Read it in Settings → stats. The count changes no gameplay.

*Caveat:* Pop! and Touch-it/Jigsaw share the same per-eye daily bucket, so on a day with mixed games the average mixes the two kinds of time. Splitting the log by game is a small follow-up if the doctor wants the numbers.

## 2. Contrast rebalancing for the fellow (right) eye — proposal, doctor decides
The standard dichoptic anti-suppression approach: show the dominant eye's targets at **reduced contrast** so the deviating eye isn't out-competed, then fade back toward equal as suppression eases. The app can do this without leaving the optics model: every tone on the field→ink line has the same wrong-eye leak ratio (HANDOFF, "Photo puzzles"), so `rampInk(eye, t)` with t < 1 is an exactly-as-clean, fainter target.
- Shape: a setting "Right-eye targets: 100% / 75% / 50%", off (100%) by default.
- **Needs from the doctor:** whether this is wanted at all for an exotrope with a normal right eye, which eye, the starting level, and how to progress it.

## 3. Uneven eye split — proposal, doctor decides
Today it is strict 50/50 alternation (or all one eye). A ratio such as 2 left : 1 right is a one-line change to `nextEye()`. AUDIT_CODEX's view: keep 50/50 as the neutral default and change it only on a prescribed ratio.

## 4. Catch trials — proposal
Nothing tells apart a child who sees the target from one guessing from sound or timing. In Pop! a catch trial would be a bubble inked for the eye that is *covered* during a deliberate cover test. That needs the parent's help, so it fits a weekly cover-one-eye check, not every session. Low priority until the stats above show something.

## 5. Fusion in Pop! — idea
Fusion mode splits one action across both eyes (piece for one, hole for the other). A Pop! version: a bubble for one eye carries a small "target ring" seen only by the other eye, and only bubbles with a ring score. Not safe until rings can never overlap a bubble (the occlusion trap in HANDOFF); park it until Wes reports how Pop! goes.

## 6. Stereo / 3D — not built
It needs the doctor's measurements (control, fusional vergence, stereoacuity) and a disparity plan for iPad viewing distance. AUDIT_CODEX covers the open questions.

## Questions to take to the doctor
1. For Leo specifically, is the aim to reduce left-eye suppression, train fusion, or both? This decides between items 2/3 and item 5.
2. Is it acceptable to lower the right eye's target contrast (item 2), and from what level?
3. Is there a target session length and frequency?
4. Which numbers would they like to see: per-eye floated-away rate and time-to-touch from Pop!, or something else?
