// Headless check of the optics model.
//
// The model is asserted three times: against a reference copy written out
// here, and against the copies actually living inside each app, lifted out
// of the HTML. Two apps now share this model, and a silent divergence
// between them would put a letter in front of the wrong eye.
const fs = require('fs');

/* ---------- lift the model out of an app ---------- */
function braceBlock(src, opener){
  const i = src.indexOf(opener);
  if (i < 0) throw new Error('not found: ' + opener);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++){
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error('unbalanced: ' + opener);
}

const NEEDED = ['weights','rgbOf','through','visible','reading','inkFor'];

function modelFrom(html, extra){
  const src = fs.readFileSync(html, 'utf8');
  const js  = src.slice(src.indexOf('<script>') + 8, src.indexOf('</script>'));
  const names = NEEDED.concat(extra || []);
  const parts = [braceBlock(js, 'const LENS = {') + ';'];
  for (const name of names) parts.push(braceBlock(js, 'function ' + name + '('));
  const body = `
    let state = {}, calibBg = '#000000';
    ${parts.join('\n')}
    return {
      setState: s => { state = s; },
      setBg: b => { calibBg = b; },
      weights, through, visible, reading, inkFor
      ${(extra || []).map(n => ', ' + n).join('')}
    };`;
  return new Function(body)();
}

/* Lift the persisted-state validator. It is a slice, not a brace block:
   SCHEMA and its validators are const arrow declarations. */
function guardsFrom(html){
  const src = fs.readFileSync(html, 'utf8');
  const js  = src.slice(src.indexOf('<script>') + 8, src.indexOf('</script>'));
  const a = js.indexOf('const oneOf =');
  const b = js.indexOf('const state = Object.assign(');
  if (a < 0 || b < 0 || b < a) throw new Error('validator block not found');
  return new Function(
    braceBlock(js, 'const LENS = {') + ';\n' + js.slice(a, b) +
    '\nreturn { sanitize, dropped: () => dropped };')();
}

/* ---------- the reference copy ---------- */
function reference(){
  const LENS = { cyan:{g:1,b:1}, green:{g:1,b:0}, blue:{g:0,b:1} };
  let state = {}, calibBg = '#000000';
  function weights(k){ if(k==='red') return [1,0,0];
    return [0, LENS[state.pair].g, state.pair==='blue'?1:state.bluePass]; }
  function rgbOf(h){ const n=parseInt(h.slice(1),16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
  function through(k,h){ const c=rgbOf(h), w=weights(k), s=w[0]+w[1]+w[2];
    return s ? (c.r*w[0]+c.g*w[1]+c.b*w[2])/s : 0; }
  function visible(k,h){ return Math.abs(through(k,h)-through(k,calibBg))/255; }
  function reading(key){ const hex = key==='red'?state.red:state.green;
    const own = visible(key==='red'?'red':state.pair, hex);
    const wrong = visible(key==='red'?state.pair:'red', hex);
    return {own, wrong, ghost: own?Math.min(1,wrong/own):1}; }
  function inkFor(eye,bg){ const w=((bg||state.bg)||'#000000').toLowerCase()==='#ffffff';
    if(eye==='both') return w?'#000000':'#ffffff';
    const red=(eye===state.redSide); return w?(red?state.green:state.red):(red?state.red:state.green); }
  return { setState: s => { state = s; }, setBg: b => { calibBg = b; },
           weights, through, visible, reading, inkFor };
}

/* ---------- the assertions ---------- */
let pass = 0, fail = 0;
function suite(label, m){
  console.log('\n' + label);
  const t = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
  const base = () => ({ pair:'green', bluePass:0, red:'#ff0000', green:'#00ff00',
                        redSide:'L', bg:'#000000' });
  let s = base();
  m.setState(s); m.setBg('#000000');

  console.log('  black field, red/green, standard inks');
  t('red ink is clean for the red eye', m.reading('red').ghost < 0.05 && m.reading('red').own > 0.9);
  t('green ink is clean for the green eye', m.reading('green').ghost < 0.05);
  t('left eye (red lens) gets red on black', m.inkFor('L','#000000') === '#ff0000');
  t('right eye gets green on black', m.inkFor('R','#000000') === '#00ff00');
  t('both eyes get white on black', m.inkFor('both','#000000') === '#ffffff');

  console.log('  white field inverts the assignment');
  m.setBg('#ffffff');
  t('left eye (red lens) gets green on white', m.inkFor('L','#ffffff') === '#00ff00');
  t('right eye gets red on white', m.inkFor('R','#ffffff') === '#ff0000');
  t('both eyes get black on white', m.inkFor('both','#ffffff') === '#000000');
  t('green ink hides from the green lens on white', m.visible('green','#00ff00') < 0.05);
  t('green ink is strong for the red lens on white', m.visible('red','#00ff00') > 0.9);

  console.log("  colors measured on a real pair of filters");
  /* The documented 33% figure for #ffaa00 is a black-field measurement. It
     used to be asserted with calibBg still left on white from the block
     above, where it passed only via the own<0.3 arm — the assertion was
     not testing what it claimed. */
  s = base(); s.pair = 'cyan'; s.bluePass = 1; s.red = '#ffaa00'; m.setState(s);
  m.setBg('#000000');
  t('yellow-orange ghosts through cyan on black', Math.abs(m.reading('red').ghost - 1/3) < 0.02);
  m.setBg('#ffffff');
  s.green = '#2effe7'; m.setState(s);
  t('#2effe7 hides from a cyan lens', m.visible('cyan','#2effe7') < 0.1);
  t('#2effe7 stays strong for the red lens', m.visible('red','#2effe7') > 0.7);
  s.red = '#ff2ecb'; m.setState(s);
  t('#ff2ecb hides from the red lens', m.visible('red','#ff2ecb') < 0.05);
  s = base(); m.setState(s);
  t('#ebdb34 is faint for both lenses (dead zone)',
    Math.abs(m.through('red','#ebdb34') - 255) / 255 < 0.2 &&
    Math.abs(m.through('green','#ebdb34') - 255) / 255 < 0.2);
}

/* Both apps. This is the bug that made calibrating on white impossible: the
   meter reported the measured, doctor-approved inks as unusable. */
function meterRolesSuite(label, m){
  console.log('\n' + label + ' — meter roles on a white field');
  const t = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
  m.setState({ pair:'cyan', bluePass:1, red:'#ff2ecb', green:'#2effe7', redSide:'L', bg:'#ffffff' });
  m.setBg('#ffffff');
  t('measured magenta reads as clean', m.reading('red').ghost < 0.06);
  t('measured magenta is not called faint', m.reading('red').own > 0.3);
  t('measured cyan reads as clean', m.reading('green').ghost < 0.06);
  t('measured cyan is not called faint', m.reading('green').own > 0.3);

  console.log('  and a leaky red filter must show pure red as bad');
  m.setState({ pair:'cyan', bluePass:1, red:'#ff0000', green:'#00ffff', redSide:'L',
               bg:'#ffffff', redBlue:1 });
  t('pure red ghosts 50% when the red lens passes blue',
    Math.abs(m.reading('red').ghost - 0.5) < 0.01);
  m.setState({ pair:'cyan', bluePass:1, red:'#ff00ff', green:'#00ffff', redSide:'L',
               bg:'#ffffff', redBlue:1 });
  t('magenta is clean through the leaky red lens', m.reading('red').ghost < 0.06);
}

/* puzzle.html only — bestInk and the tone ramp do not exist in the chart. */
function whiteFieldSuite(label, m){
  const t = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
  console.log('\n' + label + ' — cleanup and the tone ramp');
  m.setBg('#ffffff');
  /* "Clean up" used to treat a leak as absent below 15%, so at a 10% setting
     it returned pure red and left ~9% ghosting while claiming to be clean.
     The rule is any leak at all, so these boundaries must hold. */
  console.log('  cleanup honours small leaks, not just large ones');
  [0, 0.01, 0.10, 0.15, 0.16, 1].forEach(rb => {
    m.setState({ pair:'cyan', bluePass:1, red:'#ff0000', green:'#00ffff', redSide:'L',
                 bg:'#ffffff', redBlue:rb });
    const want = rb > 0 ? '#ff00ff' : '#ff0000';
    t('red-lens leak ' + Math.round(rb*100) + '% -> ' + want, m.bestInk('red') === want);
    m.setState({ pair:'cyan', bluePass:1, red:m.bestInk('red'), green:'#00ffff',
                 redSide:'L', bg:'#ffffff', redBlue:rb });
    t('  and that ink is clean', m.reading('red').ghost < 0.01);
  });

  console.log('  the tone ramp keeps the calibrated leak ratio');
  m.setState({ pair:'cyan', bluePass:1, red:'#ff2ecb', green:'#2effe7', redSide:'L', bg:'#ffffff' });
  t('t=0 is the field itself', m.rampInk('L', 0) === '#ffffff');
  t('t=1 is the calibrated ink', m.rampInk('L', 1) === m.inkFor('L', '#ffffff'));
  const ratios = [0.25, 0.5, 0.75, 1].map(k => {
    const hex = m.rampInk('L', k);
    return m.visible('cyan', hex) / m.visible('red', hex);
  });
  t('ghost ratio is the same at every tone',
    Math.max.apply(null, ratios) - Math.min.apply(null, ratios) < 0.002);
  t('contrast rises with tone',
    m.visible('red', m.rampInk('L', 0.25)) < m.visible('red', m.rampInk('L', 1)));
}

/* puzzle.html only — toned character art. The .t1/.t2 shades are CSS
   color-mix, a second path to the ramp that rampInk's tests do not reach.
   Assert the rule mixes only currentColor with the field, at the tones the
   ramp is checked at, and that every toned part is solid-only detail (.d). */
function toneArtSuite(label, m){
  const t = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
  console.log('\n' + label + ' — toned character art');
  const src = fs.readFileSync('puzzle.html', 'utf8');
  const rules = [...src.matchAll(/svg \.(t\d)\{fill:([^;}]*)/g)];
  t('a .t1 and a .t2 rule exist', ['t1','t2'].every(c => rules.some(r => r[1] === c)));
  const pct = {};
  rules.forEach(r => {
    const mm = r[2].match(/^color-mix\(in srgb, currentColor (\d+)%, var\(--bg\)\)$/);
    t('.' + r[1] + ' mixes only currentColor with the field', !!mm);
    if (mm) pct[r[1]] = Number(mm[1]) / 100;
  });
  m.setBg('#ffffff');
  m.setState({ pair:'cyan', bluePass:1, red:'#ff2ecb', green:'#2effe7', redSide:'L', bg:'#ffffff' });
  const full = m.visible('cyan', m.rampInk('L', 1)) / m.visible('red', m.rampInk('L', 1));
  Object.keys(pct).forEach(c => {
    const hex = m.rampInk('L', pct[c]);
    t('.' + c + ' tone keeps the ink\'s ghost ratio',
      Math.abs(m.visible('cyan', hex) / m.visible('red', hex) - full) < 0.002);
  });
  const tagged = [...src.matchAll(/<[a-z]+ class="([^"]*\bt\d\b[^"]*)"/g)];
  t('toned parts exist', tagged.length > 0);
  t('every toned part is class d', tagged.every(x => /\bd\b/.test(x[1])));
}

/* puzzle.html only — the chart holds no state, by design. */
function guardSuite(label, g, m){
  const t = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
  console.log('\n' + label + ' — restoring saved settings');

  const good = { mode:'blocks', pieces:6, bg:'#ffffff', eyePlan:'alt', fusion:true,
                 red:'#ff2ecb', green:'#2effe7', pair:'cyan', bluePass:1,
                 redBlue:0.4, redSide:'R', size:30, tones:3, picBias:-12 };
  t('a valid save survives intact',
    JSON.stringify(g.sanitize(good)) === JSON.stringify(good));

  console.log('  bad values are dropped, not adopted');
  /* The one that matters clinically: inkFor() asks `eye === state.redSide`,
     so any redSide outside L/R is false for both eyes and both get the same
     ink — a session that looks normal and trains nothing. */
  [['redSide', 'X'], ['redSide', null], ['redSide', 'l'],
   ['pair', 'purple'], ['pair', 'toString'], ['pair', 0],
   ['red', 'red'], ['red', '#ff00'], ['green', 123],
   ['mode', 'tetris'], ['pieces', 5], ['pieces', '4'], ['bg', '#123456'],
   ['eyePlan', 'left'], ['size', 900], ['size', 22.5], ['tones', 7],
   ['bluePass', 4], ['bluePass', NaN], ['redBlue', -1],
   ['picIdx', -1], ['picBias', 99], ['sound', 'yes'], ['fusion', 1]
  ].forEach(([k, v]) => {
    const out = g.sanitize({ [k]: v });
    t('  ' + k + ' = ' + JSON.stringify(v) + ' is refused', !(k in out));
  });

  console.log('  hostile shapes do not throw');
  t('unknown keys are dropped', !('evil' in g.sanitize({ evil:1 })));
  /* `in` would answer true for anything on Object.prototype, so this has to
     ask about own keys. A plain SCHEMA[k] lookup here returns
     Object.prototype and then tries to call it. */
  let proto = null;
  try { proto = g.sanitize(JSON.parse('{"__proto__":{"pwned":1}}')); } catch(_){}
  t('a __proto__ key is dropped, not called',
    proto && !Object.prototype.hasOwnProperty.call(proto, '__proto__'));
  t('and nothing was polluted', {}.pwned === undefined);
  ['null', '"a string"', '[1,2]', '42'].forEach(json => {
    let ok = true;
    try { g.sanitize(JSON.parse(json)); } catch(_){ ok = false; }
    t('  ' + json + ' returns empty instead of throwing',
      ok && Object.keys(g.sanitize(JSON.parse(json))).length === 0);
  });

  console.log('  and the invariant behind all of it');
  m.setState({ pair:'green', bluePass:0, red:'#ff0000', green:'#ff0000',
               redSide:'L', bg:'#ffffff' });
  t('two identical inks send both eyes the same thing',
    m.inkFor('L','#ffffff') === m.inkFor('R','#ffffff'));
  m.setState({ pair:'green', bluePass:0, red:'#ff0000', green:'#00ff00',
               redSide:'L', bg:'#ffffff' });
  t('the default pair splits on both fields',
    m.inkFor('L','#000000') !== m.inkFor('R','#000000') &&
    m.inkFor('L','#ffffff') !== m.inkFor('R','#ffffff'));
}

suite('reference model', reference());
suite('eye-trainer.html', modelFrom('eye-trainer.html'));
suite('puzzle.html', modelFrom('puzzle.html'));
meterRolesSuite('eye-trainer.html', modelFrom('eye-trainer.html'));
meterRolesSuite('puzzle.html', modelFrom('puzzle.html'));
whiteFieldSuite('puzzle.html', modelFrom('puzzle.html', ['bestInk', 'rampEnds', 'rampInk']));
toneArtSuite('puzzle.html', modelFrom('puzzle.html', ['bestInk', 'rampEnds', 'rampInk']));
guardSuite('puzzle.html', guardsFrom('puzzle.html'), modelFrom('puzzle.html'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
