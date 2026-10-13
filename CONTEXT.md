# CONTEXT — eyetrainer pair

**Current task:** Pop! demo + touch fixes + mechanism write-up are done locally; waiting for Wes's playtest with Leo before the next round.

**Key decisions**
- Pop! (one monocular bubble at a time, Mushroom Kingdom pack) is reached via `puzzle.html#pop`; the default mode is unchanged. Pop! logs to its own `anaglyph.pop.v1`, which is performance by eye, not a suppression test.
- Touch fixes are on evidence: F3 (resize mid-drag killed all drags) reproduced and fixed; F4 lifecycle backstops added and counted in `window.dragAborts`. See docs/ui-failures.md.
- Tests run only on the Air: `ssh air`, tar the tree into /tmp/eyetrainer-test, WebKit via NODE_PATH=/Users/wfr/Code/opr-iphone-shell/node_modules, Chromium CDP touch via /Users/wfr/Code/susmat-site/node_modules. Scripts live in the session scratchpad and are copied to the Air.

**Next steps**
- Wes: playtest Pop!, cover-one-eye check, and whether drags used to die after rotation. Demo is at https://giraffes-mac-mini.tail3a44c1.ts.net/puzzle.html#pop (127.0.0.1:8000 python server behind tailscale serve; stop it when the pair ends).
- H3 and H4 in docs/ui-failures.md still need reproducing (H4 needs iPad evidence).
- Doctor questions are listed in docs/training-mechanism.md; nothing clinical changes without answers.
