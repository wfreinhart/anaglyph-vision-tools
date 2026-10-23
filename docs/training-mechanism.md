# Training mechanism — proposals for Wes and the doctor

The optics model, the measured inks, and the clinical defaults (white field, strict L/R alternation, fusion off) are unchanged. Everything below that would change *what the eyes are asked to do* is a proposal for the doctor. Only item 1 is built, and it only logs; item 7 (two-colour mazes) is built but experimental and off by default.

Patient context (from AUDIT_BRIEF): age 3, exotropia, **left eye turns out**, right eye reported normal. Not established: amblyopia, fixation preference, or suppression. Which eye wears the red lens is configurable. AAPOS: exercises have no proven benefit for intermittent exotropia in general (https://www.aapos.org/glossary/exotropia).

## 1. Pop! trial log — built, logging only
Pop! shows one target at a time to one eye, with a known appearance time, so it can log each presentation. It writes its own log (`anaglyph.pop.v1`), separate from the pooled per-eye log the other games share. Each bubble shown is recorded with: eye, shape, horizontal position where it rose (x0) and where it was caught or left (x), both 0–1, size, result (`hit` or floated `away`), appearance-to-touch time for hits, lens side and ink. Other taps on the field are counted too (between bubbles included), except in the reward window just after a catch while the bubble is still popping or the burst is up. Those taps are aimed at the reward, so this count is **not** a guessing estimate. Settings → stats shows per eye: shown, caught, floated away (as a % of shown), and the median time among caught bubbles.

**What it is and isn't.** It is an exploratory, eye-conditioned **performance asymmetry** that might be worth a clinician's look. It **does not identify suppression.** The two eyes always differ in more than the eye: each eye is permanently tied to a different lens, ink and display channel, whose perceived strength the app's RGB model does not equalise. Position, path, shape and ink area, attention, fatigue and order, motor response and guessing also vary. Clinical suppression is measured with binocular sensory tests (for example dichoptic contrast thresholds), not with reaction time. Median time is computed only over caught bubbles, so it is biased toward the bubbles he did catch. Strict alternation equalises *presentations*, not completed trials.

**If the doctor wants a controlled comparison:** balance shape and horizontal-position bins across eyes, and alternate which eye starts each session (today it always starts left). The playtest doesn't need this, because nothing is being concluded from it.

## 2. Lower contrast for one eye's targets — proposal, doctor decides
Contrast-rebalancing evidence comes mainly from **amblyopia**: simultaneous binocular content, with the amblyopic eye at full contrast and the fellow eye reduced (e.g. 3–5-year-olds watching rebalanced cartoons, https://pubmed.ncbi.nlm.nih.gov/39270746/). That does not carry over directly here. Pop! shows one monocular target at a time, so lowering one eye's contrast doesn't rebalance any binocular competition; it just makes that eye's trials fainter. Leo has exotropia, not established amblyopia.

How the app *could* do it: `rampInk(eye, t)` with t < 1. In the app's linear RGB model every tone on the field→ink line has the **same predicted ghost ratio** as the full ink. That is a model prediction, not a measurement: only the full-strength inks were checked on his glasses, and the real display, filters, room light and contrast sensitivity are not linear. A low t could become invisible to the intended eye while the ratio stays the same.
- **Needs from the doctor:** whether this is wanted at all, for which eye, from what level, and how to progress it. The evidence is indirect and not validated for this child or this task.

## 3. Uneven eye split — proposal, doctor decides
Today it is strict 50/50 alternation (or all one eye). A ratio such as 2 left : 1 right is a one-line change to `nextEye()`. No therapeutic dose is claimed for any ratio. AUDIT_CODEX recommends 50/50 as the neutral default unless a ratio is prescribed.

## 4. Check trials — proposal
Two different checks, often confused:
- **Sham intervals** (no bubble for a while, all taps recorded) estimate guessing and anticipation. Item 1's field-tap count is not this: it is a by-product, not a designed sham.
- **A bubble for an eye deliberately covered** by a parent is a channel-separation / cover-compliance check (are the glasses and inks really separating the eyes?), not a suppression test. It fits a weekly parent-assisted check.

## 5. Fusion in Pop! — idea
A Pop! version of fusion mode: a bubble for one eye carries a small ring seen only by the other eye, and only bubbles with a ring score. Not safe until a ring can never overlap a bubble (the occlusion trap in HANDOFF). Parked until Wes reports how Pop! goes.

## 6. Stereo / 3D — not built
It needs the doctor's measurements (control, fusional vergence, stereoacuity) and a disparity plan for iPad viewing distance. AUDIT_CODEX lists the open questions.

## 7. Two-colour mazes — built, experimental, off by default
Maze settings has a **Colours** row. **One colour is the default**, and it is the maze as before: everything in the round's one eye. The three other modes change which eye sees what, so they are clinical behaviour: they are labelled experimental in the settings, they are never on at start, and nothing here claims any treatment effect. The choice is not saved: it is One colour on every page load and every time Maze is opened from another mode, and it is dropped if the eye plan is set to Both (Both has no other eye, so the row is shown disabled and play is one colour; going back to one eye does not turn a mode back on). "X" is the round's eye (it alternates per maze under Alternate), "Y" the other eye.

| Mode | X eye sees | Y eye sees |
|---|---|---|
| One colour (default) | walls, characters, trails, the way | nothing |
| Trail in other colour | walls, characters | both trails |
| Split walls | characters, both trails, about half the wall pieces | the other wall pieces |
| Characters vs walls | walls | both characters, both trails |

- **Split walls is a two-eye information design, not a fusion or suppression test.** Each wall piece (the outer border included, so there is no frame seen by both eyes) goes to one eye or the other, and the route through the maze is clear only from what both eyes show. It needs what both eyes see, not both eyes at the same instant, and a child can still bump into walls and learn by trial and error, so it cannot show that either eye is suppressed or that fusion happens. Each maze's split is checked by the app so that, for each eye alone, at least a set number of cells on the true route (2 to 4 depending on maze size) have a false branch: a way that only the other eye's wall closes and that, from that eye's view, still leads on to a later part of the route, so it looks like a real alternative route and not an obvious dead end. If no random split of a maze meets that in 60 tries a new maze is made, up to 20 times; only if all fail is the best split used. Where one eye's wall meets the other's the app leaves a small gap, so the two inks never touch.
- **Trail in other colour carries an intentional experimental cue.** The trails are in Y while the characters and walls are in X, so Y sees where he has been. To avoid giving Y a live position cue at the thing he acts on, the Y trail stops a cell short of its character and never runs under either character. It still traces his route, so this is **not** a clean one-eye localisation task.
- **Show the way is switched off in all three two-colour modes** (the setting is shown disabled with the reason): in Split walls it would give one eye the whole route; in Characters vs walls the way, in X, would run under Y's characters and give X their positions; in Trail in other colour the Y trail overpaints the X way, and because Y ink looks like background to the X eye, X would see white gaps marking Y's trail.
- Every colour still comes from the same ink ramp as the rest of the game, and the characters never overlap a wall of either eye. Eye separation itself can only be checked on the iPad: calibrate, then cover each eye in each mode.

**Question for the doctor:** are any of these modes wanted for Leo, and for which eye plan? Until answered they stay hidden behind the experimental row, never the default.

## Questions to take to the doctor
1. For Leo specifically, is the aim reducing suppression (if present), training fusion, or something else? This decides between items 2/3 and item 5.
2. Has fixation preference or suppression been established, and in which eye?
3. Is lowering one eye's target contrast acceptable (item 2), and from what level?
4. Is there a target session length and frequency?
5. Are Pop!'s per-eye performance numbers (item 1) useful to them, and in what form?
