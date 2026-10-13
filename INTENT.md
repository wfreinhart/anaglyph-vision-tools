# INTENT — eyetrainer pair, revision 1

## Grant (Wes, verbatim)

> Fresh look at Wes's red/green (anaglyph) eye trainer web app for his 3-year-old (Leo). Goals, in priority order: (1) MOST IMPORTANT: make it fun for a 3-year-old who loves Mario, Star Wars, Mickey Mouse and Disney characters — simple abstract/basic character-inspired art is fine (Wes says copyright isn't a concern at this abstraction level); replace stale games with fresh ones; (2) fix the UI, which doesn't always work (find and reproduce the failures first, on iPad/touch); (3) consider improvements to the actual training mechanism (left/right eye localization, dichoptic presentation), keeping the optics model and the patient's measured values intact — clinical behavior is load-bearing, doctor-directed. Repo: ~/Code/leo/redgreen-pages (git; puzzle.html, eye-trainer.html, verify.py, optics_test.js). Older non-git working copy with HANDOFF.md, AUDIT_BRIEF.md, AUDIT_CODEX.md lives in ~/Code/leo/redgreen — read those first. Ship a simple playable demo early for Wes to try (memory demo-first-not-solid-concepts). Do not push/publish to the live pages site without Wes's OK. Tests (node optics_test.js) run off the mini per no-tests-on-mini.

## Interpretation

### Goal
Leo (3, left-eye exotropia, under a doctor's care) should *want* to play the anaglyph game, and it should work every time he taps or drags on the iPad — while every target still reaches exactly the eye it is meant for. Priority order is Wes's: fun first, reliable touch UI second, training-mechanism improvements third.

### Why it matters
The therapy only works if he plays it regularly; a stale or flaky game gets refused, and a 3-year-old won't tolerate a drag that silently fails. But the optics are the treatment: a "fun" change that leaks a target to the wrong eye, or turns monocular work binocular, trains nothing while looking fine (HANDOFF: "a clinical failure that presents as a working session").

### What done looks like, and how anyone can check it
1. **Fun:** puzzle.html already has character packs (Mouse Club, Space Knights) and scenes, so "fresh" means new *game mechanics*, not more shapes. One fresh game becomes the obvious default/demo, with character-inspired art (adding a Mario-style pack: mushroom, star, pipe, coin, block). Existing modes are hidden or retired only after Wes names them stale or the Leo trial rejects them. *Check:* an early local demo, then Wes watching Leo on the actual iPad: he starts with little coaching, finishes a short round, and chooses to keep going, with no recurring confusion. A parent's novelty or a single enthusiastic tap does not count.
2. **UI works:** each touch failure is first reproduced and written down in `docs/ui-failures.md` (device or emulation, viewport/orientation, input sequence, observed vs expected, trace), then fixed, and the same script must pass afterwards. Evidence ladder: the real iPad in Safari is acceptance; Playwright WebKit with touch on the Air or desktop PC is regression evidence, labelled "emulated", never "verified on iPad". *Check:* the failure log with before/after evidence.
3. **Optics intact:** `node optics_test.js` passes with no test weakened and the measured values (`#2effe7`, `#ff2ecb`, `#ebdb34`, `#ffaa00`) unchanged; any new art goes through `inkFor`/ramp paths, never hand-picked colours. New drawing paths get covered by verify/optics tests (e.g. every drawn colour in a new game is on an eye's ramp). *Check:* test output + a manual cover-one-eye pass on the iPad (HANDOFF manual checklist).
4. **Training mechanism:** proposals written up (per-eye weighting options, catch trials, graded fusion cue, honest latency logging — from AUDIT_CODEX), with only clinically neutral ones implemented by default; anything that changes dosing/eye split is off-by-default and flagged for the doctor. *Check:* the write-up and defaults in code.

### Limits
- No push/publish to the live pages site, no deploy, no outward action without Wes's OK. Local commits only, via `seat-commit`.
- Do not change the optics model, `inkFor`, the measured patient values, or clinical defaults (eye alternation 50/50, fusion off, white field) — those are doctor-directed. New clinical behaviour lands off-by-default and is reported for the doctor.
- No stereo/disparity mode is implemented or enabled. It may be *proposed* in the mechanism write-up, but building it needs doctor-supplied measurements (support correction, accepted).
- Stay offline-capable: no CDNs, fonts, network or audio files (HANDOFF conventions).
- No executable tests on the mini: not `optics_test.js`, not `verify.py`, not headless browsers. They run on the MacBook Air (git archive + rsync, one suite at a time) or the desktop PC via WSL (AgentVault no-tests-on-mini). Static reading is fine.
- Nothing is deleted. Jigsaw stays (the patient asked for puzzles). Existing modes move out of the default menu only on Wes's word or trial evidence.
- Every element the child acts on uses one eye's ink on the field→ink ramp. Binocular decoration never sits near, behind or under a target (no outlines, shadows, alignment or particle origins that give away position). Rewards may be binocular only after success. No CSS shadows, filters, blend modes or translucent chrome on clinical art (support framing, accepted).
- *Assumption:* the old non-git copy in `~/Code/leo/redgreen` is reference only; all work happens in `redgreen-pages`.
- *Assumption:* character art is simple original silhouettes evoking the characters — no traced logos, no sprite rips, no copyrighted image files — which keeps it within "abstract/basic".
- Standing limits apply to everything else (no spending, no touching other systems or people).

## Decision record

- 2026-10-13: support framing accepted in full. Changes: "fresh" means new mechanics, since packs and scenes already exist; stereo may be proposed but not built; no-tests-on-mini covers verify.py too; I added the decoration-leak rule. Why: each was verified against current puzzle.html or the policy page, and none enlarges the grant.
- 2026-10-13: support's pre-playtest blocker accepted. Pop! shows one bubble at a time (opposite-eye bubbles overlapping punch field-coloured holes in each other: a wrong-eye position cue), the next bubble waits for the binocular burst to clear, and a bubble already caught can't be scored again. Why: the cost is only a few lines, and the alternative is a leak that looks like a working session. Multi-bubble Pop needs collision-free lanes before it is exposed clinically (backlog).
- 2026-10-13: drag lifecycle backstops added on support's advice even though only the resize path (F3) was reproduced. Why: they release state on lifecycle events rather than masking an error, every firing is counted by reason (instrumentation, not a silent catch), and the gear path could not be ruled out for iOS.
- 2026-10-13: support's clinical-honesty corrections accepted in full. Pop! gets its own per-presentation log (covariates, empty-field taps, median); the mechanism doc no longer calls it a suppression signal, says "same predicted ghost ratio in the model" instead of "exactly as clean", and frames contrast rebalancing as amblyopia evidence that doesn't directly apply to Leo. Why: the earlier wording would have overclaimed to the doctor; the log split was needed before any number reaches them.
- 2026-10-13: support's pre-handoff corrections accepted. Field taps are no longer counted during the post-catch reward window and are labelled "other taps", not a guessing estimate; x0 is now logged. The handoff to Wes puts a calibration and cover-one-eye check on the real iPad first, because emulation cannot show eye separation and `#pop` does not load his measured inks by itself.
