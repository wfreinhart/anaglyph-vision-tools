# Anaglyph vision tools

Two dependency-free, single-file web apps for red/green (anaglyph) vision
exercises. No build, no network, no tracking. Open the HTML file, or use the
hosted copy.

- **`puzzle.html`** — Shape Hunt. Jigsaw (shapes or your own photo), blocks,
  shape sorter and touch modes, aimed at a preschooler.
- **`eye-trainer.html`** — anaglyph letter chart with a calibration wizard.

## The optics, in one paragraph

Anaglyph filters are subtractive, and what an eye perceives is contrast
against the *background*, not brightness. On black a target shows by being
bright; on white it shows by being dark, and the eye assignment inverts. Real
filters also leak — a "green" lens usually passes blue, and a red filter leaks
blue too, which is why a magenta ink beats a pure red one on a white field.
Both apps model this and show a live ghosting meter so you can tune to the
glasses you actually own.

Every tone on the straight line between the field colour and a calibrated ink
carries the same wrong-eye leak ratio as the ink, which is why the photo
jigsaw works: a posterised or greyscale picture is optically as clean as a
solid silhouette.

## Tests

```bash
python3 verify.py       # structural checks on both HTML files
node optics_test.js     # the colour model, incl. leak boundaries
```

`optics_test.js` runs the same suite three times: against a reference model
written out in the test, and against the copies lifted out of each HTML file,
so the two apps cannot silently diverge.

## Not a medical device

Built for one child at their eye doctor's direction and shared in case it is
useful to someone. It has no clinical validation. Talk to your own optometrist
or ophthalmologist before using anything like this — in particular, exercises
that split a task across the two eyes are not appropriate for everyone.
