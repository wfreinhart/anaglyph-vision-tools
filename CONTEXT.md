# CONTEXT — eyetrainer pair

**Current task:** first playable demo (Pop! mode + Mushroom Kingdom pack) shipped locally for Wes to try; UI-failure repro track next.

**Key decisions**
- First fresh game is Pop! (Touch-it with motion), not a new pack, because packs and scenes already exist. It is reached via `puzzle.html#pop`; the default mode is unchanged until Wes says otherwise.
- Tests run on the Air (`ssh air`, tar the working tree into /tmp/eyetrainer-test, Playwright WebKit via NODE_PATH=/Users/wfr/Code/opr-iphone-shell/node_modules); nothing executes on the mini.
- Demo server: 127.0.0.1:8000 behind the existing tailnet `tailscale serve` root → https://giraffes-mac-mini.tail3a44c1.ts.net/puzzle.html#pop (tailnet only, not the public pages site).

**Next steps**
- Reproduce H1–H3 in docs/ui-failures.md under emulation (resize mid-drag, lost capture, tap slide-off), then fix confirmed ones.
- Write up the training-mechanism proposals (escape/exposure logging per eye, catch trials, graded fusion cue); clinical changes stay off by default.
- Await Wes's playtest of Pop! with Leo before retiring any old mode.
