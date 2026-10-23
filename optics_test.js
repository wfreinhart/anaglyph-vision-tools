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
  if (js.indexOf('const MAZE = {') >= 0) parts.push(braceBlock(js, 'const MAZE = {') + ';');
  for (const name of names) parts.push(braceBlock(js, 'function ' + name + '('));
  const body = `
    let state = {}, calibBg = '#000000';
    ${parts.join('\n')}
    return {
      setState: s => { state = s; },
      setBg: b => { calibBg = b; },
      weights, through, visible, reading, inkFor
      ${typeof extra !== 'undefined' && js.indexOf('const MAZE = {') >= 0 ? ', MAZE' : ''}
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

/* puzzle.html only — Maze mode. Three things: the generator and walker
   (lifted whole, they touch no DOM and no state), the inks (every colour the
   maze draws is the round's eye on the ramp), and a static read of the maze
   source for the rules that cannot be run here (no opacity, filters,
   shadows, blend modes or hand-picked colours on the play surface). */
function mazeSuite(label, m, g){
  const t = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
  console.log('\n' + label + ' — maze');
  const SIZES = [3, 4, 6, 8], SEEDS = 250;
  const bits = v => (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1) + ((v >> 3) & 1);
  const nb = (maze, i) => {
    const n = maze.n, c = i % n, r = (i - c) / n, out = [];
    [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]].forEach(d => {
      if (maze.open[i] & d[2]) out.push((r + d[1]) * n + c + d[0]);
    });
    return out;
  };
  /* trail invariant: starts at start, no repeats, each step an open passage */
  const sound = (maze, trail) => {
    if (trail[0] !== maze.start) return false;
    if (new Set(trail).size !== trail.length) return false;
    for (let k = 1; k < trail.length; k++) if (nb(maze, trail[k - 1]).indexOf(trail[k]) < 0) return false;
    return true;
  };
  const countRoutes = maze => {          // simple paths start -> goal
    let found = 0;
    const seen = new Set([maze.start]);
    (function go(at){
      if (at === maze.goal){ found++; return; }
      nb(maze, at).forEach(to => { if (!seen.has(to)){ seen.add(to); go(to); seen.delete(to); } });
    })(maze.start);
    return found;
  };

  console.log('  generator: ' + SEEDS + ' seeds at each of ' + SIZES.join(', '));
  SIZES.forEach(n => {
    let perfect = true, connected = true, unique = true, corners = true, symmetric = true, solved = true;
    const seen = new Set();
    for (let seed = 0; seed < SEEDS; seed++){
      const mz = m.makeMaze(n, seed * 2654435761 % 4294967296);
      let edges = 0;
      mz.open.forEach((v, i) => {
        edges += bits(v);
        const c = i % n, r = (i - c) / n;
        if (((v & 1) && r === 0) || ((v & 4) && r === n - 1) || ((v & 2) && c === n - 1) || ((v & 8) && c === 0)) symmetric = false;
        if ((v & 2) && !(mz.open[i + 1] & 8)) symmetric = false;
        if ((v & 4) && !(mz.open[i + n] & 1)) symmetric = false;
      });
      if (edges / 2 !== n * n - 1) perfect = false;
      const reach = new Set([mz.start]), q = [mz.start];
      for (let k = 0; k < q.length; k++) nb(mz, q[k]).forEach(to => { if (!reach.has(to)){ reach.add(to); q.push(to); } });
      if (reach.size !== n * n) connected = false;
      if (countRoutes(mz) !== 1) unique = false;
      const cs = [0, n - 1, n * n - n, n * n - 1];
      const opp = { 0:n * n - 1, [n - 1]:n * n - n, [n * n - n]:n - 1, [n * n - 1]:0 };
      if (cs.indexOf(mz.start) < 0 || opp[mz.start] !== mz.goal) corners = false;
      const path = m.mazeSolve(mz);
      if (path[0] !== mz.start || path[path.length - 1] !== mz.goal || !sound(mz, path)) solved = false;
      seen.add(mz.open.join(','));
    }
    t(n + 'x' + n + ': every maze is perfect (n*n-1 passages)', perfect);
    t(n + 'x' + n + ': every cell reachable', connected);
    t(n + 'x' + n + ': exactly one route start to goal', unique);
    t(n + 'x' + n + ': passages are mutual and none leads off the grid', symmetric);
    t(n + 'x' + n + ': start and goal are opposite corners', corners);
    t(n + 'x' + n + ': mazeSolve returns that route', solved);
    t(n + 'x' + n + ': seeds give different mazes', seen.size > (n === 3 ? 4 : 50));
  });
  t('same seed, same maze', JSON.stringify(m.makeMaze(6, 12345)) === JSON.stringify(m.makeMaze(6, 12345)));

  console.log('  rails: continuous movement');
  const MZ = m.MAZE, EPS = 1e-6;
  const openEdge = (maze, a, b) => nb(maze, a).indexOf(b) >= 0;
  /* A walker is legal when its trail is a legal path from `from` (no repeats) and its tip
     rests on the head or sits strictly inside an open passage that the trail has not used. */
  const legalW = (maze, w, from) => {
    const tr = w.trail;
    if (tr[0] !== from || new Set(tr).size !== tr.length) return false;
    for (let k = 1; k < tr.length; k++) if (!openEdge(maze, tr[k - 1], tr[k])) return false;
    if (w.nx < 0) return w.f === 0;
    return w.f > 0 && w.f < 1 && openEdge(maze, tr[tr.length - 1], w.nx) && tr.indexOf(w.nx) < 0;
  };
  const cellsOf = w => w.nx < 0 ? [w.trail[w.trail.length - 1]] : [w.trail[w.trail.length - 1], w.nx];
  const pathLen = w => w.trail.length - 1 + w.f;
  const clone = w => ({ trail:w.trail.slice(), nx:w.nx, f:w.f });
  /* Watches a walker through every slide: each step lands on an open edge, travels no further
     than MAZE.step along the rails (so, by Manhattan distance, no further than that on screen),
     and two steps in a row share a cell (the same edge, or one junction). */
  const watcher = (maze, w, from, rec) => {
    let prev = { p:m.mazePoint(maze, w), cells:cellsOf(w), len:pathLen(w) };
    return () => {
      const p = m.mazePoint(maze, w), cells = cellsOf(w);
      rec.steps++;
      if (!legalW(maze, w, from)) rec.bad = (rec.bad || 'illegal state');
      if (Math.abs(p.x - prev.p.x) + Math.abs(p.y - prev.p.y) > MZ.step + EPS) rec.bad = rec.bad || 'step too long';
      if (!cells.some(c => prev.cells.indexOf(c) >= 0)) rec.bad = rec.bad || 'moved between unconnected edges';
      if (Math.abs(pathLen(w) - prev.len) > MZ.step + EPS) rec.bad = rec.bad || 'trail length jumped';
      rec.len.push(pathLen(w));
      prev = { p:p, cells:cells, len:pathLen(w) };
    };
  };
  const SZ = [3, 4, 6, 8];
  let hostile = true, wallStops = true, wallsSeen = 0, follows = true, wobbles = true, grows = true, retracts = true, parallel = true, steps = 0, hostileEnd = true;
  const rnd = m.mazeRng(99);
  SZ.forEach(n => {
    const cs = 60, ctr = i => ({ x:(i % n + 0.5) * cs, y:(Math.floor(i / n) + 0.5) * cs });
    for (let seed = 1; seed <= 60; seed++){
      const mz = m.makeMaze(n, seed), route = m.mazeSolve(mz);

      /* A hostile finger: huge jumps all over (and off) the grid. */
      {
        const w = m.mazeWalker(mz.start), rec = { steps:0, len:[] };
        let last = ctr(mz.start);
        const watch = watcher(mz, w, mz.start, rec);
        for (let k = 0; k < 300; k++){
          const p = { x:(rnd() * 1.6 - 0.3) * n * cs, y:(rnd() * 1.6 - 0.3) * n * cs };
          m.mazeSlide(mz, w, last, p, cs, null, watch);
          last = p;
          if (!legalW(mz, w, mz.start)) hostileEnd = false;
        }
        steps += rec.steps;
        if (rec.bad){ hostile = false; console.log('    ' + rec.bad); }
      }

      /* Straight through every wall at each cell along the route, from the cell centre and far
         past it: the character does not move at all. */
      route.forEach((cell, k) => {
        const hc = ctr(cell);
        [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]].forEach(d => {
          if (mz.open[cell] & d[2]) return;
          wallsSeen++;
          const w = { trail:route.slice(0, k + 1), nx:-1, f:0 }, before = JSON.stringify(w);
          m.mazeSlide(mz, w, hc, { x:hc.x + d[0] * cs * 3, y:hc.y + d[1] * cs * 3 }, cs);
          if (JSON.stringify(w) !== before) wallStops = false;
        });
      });

      /* Parallel corridors: from each cell the finger runs across a wall into the cell next door
         (whose own corridor is open to it only the long way round) and on along that corridor.
         The character stays inside its own passages the whole time. */
      route.forEach((cell, k) => {
        [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]].forEach(d => {
          const c = cell % n + d[0], r = Math.floor(cell / n) + d[1];
          if ((mz.open[cell] & d[2]) || c < 0 || c >= n || r < 0 || r >= n) return;
          const w = { trail:route.slice(0, k + 1), nx:-1, f:0 }, rec = { steps:0, len:[] };
          const at = ctr(cell), nbr = ctr(r * n + c);
          const watch = watcher(mz, w, mz.start, rec);
          m.mazeSlide(mz, w, at, nbr, cs, null, watch);
          m.mazeSlide(mz, w, nbr, { x:nbr.x + d[1] * cs * 2, y:nbr.y + d[0] * cs * 2 }, cs, null, watch);
          if (rec.bad || !legalW(mz, w, mz.start)) parallel = false;
        });
      });

      /* Following the finger along the route: through the cell centres, and with a wobble of up
         to 0.15 cell either side of the line (not at the corners). Grows continuously. */
      [0, 0.15].forEach(wob => {
        const w = m.mazeWalker(mz.start), rec = { steps:0, len:[] }, watch = watcher(mz, w, mz.start, rec);
        let last = ctr(mz.start), side = 1;
        for (let i = 1; i < route.length; i++){
          const a = ctr(route[i - 1]), b = ctr(route[i]), px = -(b.y - a.y) / cs, py = (b.x - a.x) / cs;
          for (let q = 1; q <= 4; q++){
            const off = q === 4 ? 0 : wob * cs * side;
            side = -side;
            const p = { x:a.x + (b.x - a.x) * q / 4 + px * off, y:a.y + (b.y - a.y) * q / 4 + py * off };
            m.mazeSlide(mz, w, last, p, cs, null, watch);
            last = p;
          }
        }
        for (let q = 1; q < rec.len.length; q++) if (rec.len[q] < rec.len[q - 1] - EPS) grows = false;
        if (rec.bad || w.trail.join() !== route.join() || w.nx >= 0){ (wob ? wobbles = false : follows = false); }
      });

      /* Out along the route and back: the trail grows without a jump and retracts without one,
         down to the start. */
      {
        const w = m.mazeWalker(mz.start), rec = { steps:0, len:[] }, watch = watcher(mz, w, mz.start, rec);
        let last = ctr(mz.start);
        const go = (to) => { for (let q = 1; q <= 10; q++){
          const p = { x:last.x + (to.x - last.x) * q / 10, y:last.y + (to.y - last.y) * q / 10 };
          m.mazeSlide(mz, w, { x:p.x - (to.x - last.x) / 10, y:p.y - (to.y - last.y) / 10 }, p, cs, null, watch); } last = to; };
        for (let i = 1; i < route.length; i++) go(ctr(route[i]));
        const peak = rec.len.length;
        if (rec.bad || w.trail.join() !== route.join()) grows = false;
        for (let i = route.length - 2; i >= 0; i--) go(ctr(route[i]));
        for (let q = peak + 1; q < rec.len.length; q++) if (rec.len[q] > rec.len[q - 1] + EPS) retracts = false;
        if (rec.bad || w.trail.join() !== String(mz.start) || w.nx >= 0 || w.f !== 0) retracts = false;
        if (Math.max.apply(null, rec.len) < route.length - 1 - EPS) retracts = false;
      }
    }
  });
  t('a hostile finger (300 huge jumps per maze, ' + steps + ' slides) never leaves the rails: every step on an open edge, short, and joined to the last', hostile && hostileEnd && steps > 1000);
  t('a flick through ' + wallsSeen + ' walls does not move the character at all', wallStops && wallsSeen > 0);
  t('a finger running across a wall and along the next corridor never pulls the character out of its own passages', parallel);
  t('following the finger through the cell centres walks the whole route', follows);
  t('and with a wobble of 0.15 cell either side of the line', wobbles);
  t('the trail grows smoothly, never shrinking, while the finger goes forward', grows);
  t('and retracts smoothly, never growing, back to the start', retracts);
  t('a finger that lands a cell ahead is caught up with gradually: one sample slides at most ' + MZ.step + ' cell, and settling on release arrives', (() => { let ok = true;
    SZ.forEach(n => { for (let seed = 1; seed <= 30; seed++){
      const cs = 60, mz = m.makeMaze(n, seed), route = m.mazeSolve(mz), to = { x:(route[1] % n + 0.5) * cs, y:(Math.floor(route[1] / n) + 0.5) * cs };
      const from = { x:(route[0] % n + 0.5) * cs, y:(Math.floor(route[0] / n) + 0.5) * cs };
      const w = m.mazeWalker(route[0]), v = m.mazeWalker(route[0]);
      m.mazeSlide(mz, w, to, to, cs);                                           // finger placed at the next cell's centre
      if (w.nx !== route[1] || Math.abs(w.f - MZ.step) > EPS) ok = false;
      m.mazeSlide(mz, v, to, to, cs, null, null, true);
      if (v.trail.join() !== route[0] + ',' + route[1] || v.nx >= 0) ok = false;
    } });
    return ok; })());
  t('a one-sample jump to the goal corner leaves a legal walker', (() => { let ok = true;
    SZ.forEach(n => { const cs = 60, mz = m.makeMaze(n, 5), w = m.mazeWalker(mz.start);
      m.mazeSlide(mz, w, { x:cs / 2, y:cs / 2 }, { x:(mz.goal % n + 0.5) * cs, y:(Math.floor(mz.goal / n) + 0.5) * cs }, cs);
      if (!legalW(mz, w, mz.start)) ok = false; });
    return ok; })());

  /* The way between two characters is measured along the corridors. */
  console.log('  gap along the corridors');
  {
    let startGap = true, sym = true, wallGap = true, sameEdge = true, wallPairs = 0, midEdge = true;
    SZ.forEach(n => {
      for (let seed = 1; seed <= 60; seed++){
        const mz = m.makeMaze(n, seed), route = m.mazeSolve(mz);
        const A = m.mazeWalker(mz.start), B = m.mazeWalker(mz.goal);
        if (Math.abs(m.mazeGap(mz, A, B) - (route.length - 1)) > EPS) startGap = false;
        /* side by side across a wall: one cell apart on screen, further along the corridors */
        for (let i = 0; i < n * n; i++) [[1,2],[n,4]].forEach(([dc, bit]) => {
          const j = i + dc;
          if (j >= n * n || (dc === 1 && i % n === n - 1) || (mz.open[i] & bit)) return;
          wallPairs++;
          const g = m.mazeGap(mz, m.mazeWalker(i), m.mazeWalker(j));
          if (g < 3 - EPS || m.mazeJoined(mz, m.mazeWalker(i), m.mazeWalker(j))) wallGap = false;
        });
        /* two walkers on one passage, either way round, and on neighbouring passages */
        for (let k = 0; k + 1 < route.length; k++){
          const u = route[k], v = route[k + 1];
          const a = { trail:[u], nx:v, f:0.2 }, b = { trail:[u], nx:v, f:0.7 }, c = { trail:[v], nx:u, f:0.1 };
          if (Math.abs(m.mazeGap(mz, a, b) - 0.5) > EPS || Math.abs(m.mazeGap(mz, a, c) - 0.7) > EPS) sameEdge = false;
          if (Math.abs(m.mazeGap(mz, a, c) - m.mazeGap(mz, c, a)) > EPS) sym = false;
          if (k + 2 < route.length){
            const x = route[k + 2], d = { trail:[v], nx:x, f:0.3 };
            if (Math.abs(m.mazeGap(mz, a, d) - (0.8 + 0.3)) > EPS) midEdge = false;     // a is 0.8 from v; d is 0.3 past it
          }
        }
      }
    });
    t('the gap at the start is the length of the route', startGap);
    t('two characters on one passage are |difference| apart, whichever way round (and the gap is symmetric)', sameEdge && sym);
    t('two characters on neighbouring passages are the distance through the shared junction', midEdge);
    t('side by side across ' + wallPairs + ' walls the gap is the way round (3+ cells), never the screen distance, and they have not met', wallGap && wallPairs > 50);
  }

  /* Two characters: each starts at its own corner; they have met when the way between them is
     MAZE.meet or less. Trails may overlap and cross; a character on the other's trail has not met. */
  console.log('  two characters, meeting');
  {
    let safe = true, noEarly = true, joinsOk = true, mid = true, body = true, bodies = 0, wallBlocks = true, bothWalls = 0,
        retract = true, relJoin = true, thresholdExact = true, early = 0;
    const hostileRnd = m.mazeRng(4242);
    SZ.forEach(n => {
      const cs = 60, ctr = i => ({ x:(i % n + 0.5) * cs, y:(Math.floor(i / n) + 0.5) * cs });
      for (let seed = 1; seed <= 60; seed++){
        const mz = m.makeMaze(n, seed), route = m.mazeSolve(mz), L = route.length;
        const mk = (cells, tip) => ({ trail:cells.slice(), nx:tip ? tip[0] : -1, f:tip ? tip[1] : 0 });
        /* a finger for one walker: remembers where it is */
        const fingerOf = (w) => { const f = { at:m.mazePoint(mz, w), res:null };
          f.at = { x:f.at.x * cs, y:f.at.y * cs };
          f.go = (to, other) => { f.res = m.mazeSlide(mz, w, f.at, to, cs, other); f.at = to; return f.res; };
          f.hop = (cells, other) => { let r = null; cells.forEach(i => { r = f.go(ctr(i), other); }); return r; };
          return f; };

        /* Hostile fingers on both characters at once, interleaved: both stay legal, and a slide
           reports a meeting exactly when the gap is at or under MAZE.meet. */
        {
          const A = m.mazeWalker(mz.start), B = m.mazeWalker(mz.goal), fa = fingerOf(A), fb = fingerOf(B);
          let met = false;
          for (let k = 0; k < 300 && !met; k++){
            const p = { x:(hostileRnd() * 1.6 - 0.3) * n * cs, y:(hostileRnd() * 1.6 - 0.3) * n * cs };
            const useA = hostileRnd() < 0.5, r = useA ? fa.go(p, B) : fb.go(p, A);
            if (!legalW(mz, A, mz.start) || !legalW(mz, B, mz.goal)) safe = false;
            const g = m.mazeGap(mz, A, B);
            if (r.joined){ met = true; if (g > MZ.meet + EPS) joinsOk = false; }
            else if (g <= MZ.meet + EPS) noEarly = false;
          }
        }

        /* One character does the whole job alone, from either end: it meets the other exactly when
           the gap reaches MAZE.meet (not before), a little over half a cell short of its cell. */
        [false, true].forEach(fromGoal => {
          const rt = fromGoal ? route.slice().reverse() : route;
          const A = m.mazeWalker(rt[0]), B = m.mazeWalker(rt[L - 1]), fa = fingerOf(A);
          let r = null, gapBefore = Infinity;
          for (let i = 1; i < L && !(r && r.joined); i++){
            // walk the hop in finger samples of a tenth of a cell so the gap just before the meeting is seen
            const a = ctr(rt[i - 1]), b = ctr(rt[i]);
            for (let q = 1; q <= 10 && !(r && r.joined); q++){
              gapBefore = m.mazeGap(mz, A, B);
              r = fa.go({ x:a.x + (b.x - a.x) * q / 10, y:a.y + (b.y - a.y) * q / 10 }, B);
            }
          }
          if (!r || !r.joined || !legalW(mz, A, rt[0])) joinsOk = false;
          else {
            const g = m.mazeGap(mz, A, B);
            if (g > MZ.meet + EPS || gapBefore <= MZ.meet || g < MZ.meet - MZ.step - EPS) thresholdExact = false;
            if (A.trail.join() !== rt.slice(0, L - 1).join() || A.nx !== rt[L - 1]) joinsOk = false;
          }
        });

        /* Meet in the middle: A rests on route[mid], B on route[mid + 2] (two cells apart), then
           B comes to route[mid + 1] (one apart; not met) and on toward A (met half a cell short). */
        if (L >= 4){
          const k = Math.floor(L / 2) - 1;
          const A = m.mazeWalker(mz.start), B = m.mazeWalker(mz.goal), fa = fingerOf(A), fb = fingerOf(B);
          fa.hop(route.slice(1, k + 1), B);
          fb.hop(route.slice(k + 2, L - 1).reverse(), A);
          if (m.mazeJoined(mz, A, B) || Math.abs(m.mazeGap(mz, A, B) - 2) > EPS) noEarly = false;
          const r1 = fb.hop([route[k + 1]], A);
          if (r1.joined || m.mazeJoined(mz, A, B) || Math.abs(m.mazeGap(mz, A, B) - 1) > EPS) noEarly = false;
          const r2 = fb.hop([route[k]], A);
          if (!r2.joined || !m.mazeJoined(mz, A, B)) mid = false;
          if (A.trail.join() !== route.slice(0, k + 1).join() || A.nx >= 0) mid = false;
        }

        /* A on the middle of B's trail is not a meeting. B walks the route back from the goal, past
           route[k], and into a side passage off it; A then walks onto route[k] and has not met B
           (B's tip is a cell away); on into the side passage it has. B retracting onto A meets too. */
        for (let k = 1; k < L - 1; k++){
          const side = nb(mz, route[k]).find(c => route.indexOf(c) < 0);
          if (side === undefined) continue;
          bodies++;
          const A = m.mazeWalker(mz.start), B = m.mazeWalker(mz.goal), fa = fingerOf(A), fb = fingerOf(B);
          fa.hop(route.slice(1, k), B);
          fb.hop(route.slice(k, L - 1).reverse().concat([side]), A);
          if (m.mazeJoined(mz, A, B) || B.trail.indexOf(route[k]) < 0 || B.trail[B.trail.length - 1] !== side) body = false;
          const bBefore = JSON.stringify(B), B2 = clone(B), fb2 = fingerOf(B2);
          const r = fa.hop([route[k]], B);
          if (r.joined || m.mazeJoined(mz, A, B) || A.trail[A.trail.length - 1] !== route[k] || JSON.stringify(B) !== bBefore || B.trail.indexOf(route[k]) < 0) body = false;
          if (Math.abs(m.mazeGap(mz, A, B) - 1) > EPS) body = false;
          const A2 = clone(A);
          const r2 = fa.hop([side], B);
          if (!r2.joined || !m.mazeJoined(mz, A, B)) body = false;
          /* B retracting from its side passage onto A's tip meets it, and un-draws its own trail only */
          const aBefore = JSON.stringify(A2), rr = fb2.hop([route[k]], A2);
          if (!rr.joined || !m.mazeJoined(mz, A2, B2) || JSON.stringify(A2) !== aBefore || B2.trail.length > B.trail.length) relJoin = false;
          break;
        }

        /* No meeting through a wall: from each cell on the route, the finger pushes the character
           through a closed wall that faces a cell of the other character's trail. Nothing moves
           and they have not met. */
        for (let k = 1; k < L - 1; k++){
          const A = mk(route.slice(0, k + 1)), B = m.mazeWalker(route[L - 1]), fb = fingerOf(B);
          fb.hop(route.slice(k + 1, L - 1).reverse(), A);
          const hc = ctr(route[k]);
          [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]].forEach(d => {
            if (mz.open[route[k]] & d[2]) return;
            const c = route[k] % n + d[0], rr = Math.floor(route[k] / n) + d[1];
            if (c < 0 || c >= n || rr < 0 || rr >= n || B.trail.indexOf(rr * n + c) < 0) return;
            bothWalls++;
            const A2 = clone(A), before = JSON.stringify(A2);
            const r = m.mazeSlide(mz, A2, hc, { x:hc.x + d[0] * cs * 3, y:hc.y + d[1] * cs * 3 }, cs, B);
            if (r.joined || JSON.stringify(A2) !== before || m.mazeJoined(mz, A2, B)) wallBlocks = false;
          });
        }

        /* Retraction undoes progress: out two cells, back to the start, nothing met. */
        if (L >= 6){
          const A = m.mazeWalker(mz.start), B = m.mazeWalker(mz.goal), fa = fingerOf(A), fb = fingerOf(B);
          fb.hop(route.slice(L - 3, L - 1).reverse(), A);
          fa.hop(route.slice(1, 3), B); fa.hop([route[1]], B); fa.hop([route[0]], B);
          if (A.trail.join() !== String(mz.start) || A.nx >= 0 || m.mazeJoined(mz, A, B)) retract = false;
        }
      }
    });
    t('both characters stay on the rails, under hostile fingers on both at once', safe);
    t('a slide reports the meeting exactly when the gap reaches ' + MZ.meet + ' cell, never before', joinsOk && noEarly);
    t('one character alone reaches the other from either end, stopping ' + MZ.meet + ' cell short (not earlier than that)', joinsOk && thresholdExact);
    t('meeting in the middle: two cells apart, one cell apart, then half a cell closes it', mid && noEarly);
    t('standing on the middle of the other trail does NOT meet; reaching its tip after does (' + bodies + ' side-passage cases)', body && relJoin && bodies > 20);
    t('a flick through ' + bothWalls + ' walls that face the other character never meets and never moves', wallBlocks && bothWalls > 20);
    t('backing a trail out and in leaves nothing met', retract);
  }

  console.log('  inks');
  const states = [
    { pair:'green', bluePass:0, red:'#ff0000', green:'#00ff00', redSide:'L', bg:'#ffffff' },
    { pair:'cyan', bluePass:1, red:'#ff2ecb', green:'#2effe7', redSide:'R', bg:'#ffffff' }
  ];
  let onRamp = true, ratioKept = true, nCol = 0;
  states.forEach((base, si) => {
    ['line', 'light', 'dots'].forEach(trail => ['full', 'medium'].forEach(wall => ['L', 'R', 'both'].forEach(eye => {
      m.setBg('#ffffff');
      m.setState(Object.assign({}, base, { mazeTrail:trail, mazeWall:wall }));
      const ink = m.mazeInks(eye);
      const allowed = [m.inkFor(eye), m.rampInk(eye, 0.6), m.rampInk(eye, 0.45)];
      const keys = Object.keys(ink);
      if (keys.slice().sort().join() !== 'piece,solution,trail,wall') onRamp = false;
      keys.forEach(k => {
        nCol++;
        if (allowed.indexOf(ink[k]) < 0) onRamp = false;
        if (!/^#[0-9a-f]{6}$/.test(ink[k])) onRamp = false;
        if (eye !== 'both' && si === 1){
          const full = m.visible('cyan', m.inkFor(eye)) / m.visible('red', m.inkFor(eye));
          const r = m.visible('cyan', ink[k]) / m.visible('red', ink[k]);
          if (Math.abs(r - full) > 0.002) ratioKept = false;
        }
      });
      if (ink.piece !== m.inkFor(eye)) onRamp = false;
      if (ink.solution !== m.rampInk(eye, 0.45)) onRamp = false;
      if (ink.wall !== (wall === 'medium' ? m.rampInk(eye, 0.6) : m.inkFor(eye))) onRamp = false;
      if (ink.trail !== (trail === 'light' ? m.rampInk(eye, 0.6) : m.inkFor(eye))) onRamp = false;
    })));
  });
  t('all ' + nCol + ' maze colours are inkFor or rampInk of the round\'s eye', onRamp);
  t('every maze colour keeps the ink\'s ghost ratio (measured cyan/magenta)', ratioKept);
  m.setState(Object.assign({}, states[0], { mazeTrail:'line', mazeWall:'full' }));
  t('left and right eyes get different maze ink', m.mazeInks('L').wall !== m.mazeInks('R').wall);
  t('the way is fainter than the walls', m.visible('green', m.mazeInks('R').solution) < m.visible('green', m.mazeInks('R').wall));

  console.log('  source rules');
  const src = fs.readFileSync('puzzle.html', 'utf8');
  const a = src.indexOf('/* ---------- maze ----------'), b = src.indexOf('/* ---------- interaction ----------');
  const mazeSrc = src.slice(a, b);
  t('maze section found', a > 0 && b > a);
  const code = mazeSrc.replace(/\/\*[\s\S]*?\*\//g, '');
  t('no colour literal in the maze code', !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(code));
  t('no opacity, filter, shadow, blend or mask in the maze code',
    !/opacity|style\.filter|filter:|shadow|blend|mask|backdrop/i.test(code));
  t('every svg paint is an ink from mazeInks', [...code.matchAll(/stroke\('[a-z]+', ([^,]+),/g)].every(x => /^ink\.[a-z]+$/.test(x[1])) &&
    [...code.matchAll(/stroke\('[a-z]+', /g)].length === 3);
  t('both characters take their colour from mazeInks, the same full ink', /makeThing\(mz\.shapes\[k\], ink\.piece,/.test(code) && !/ink\.(mover|goal)\b/.test(code));
  t('both trails are painted from one call with ink.trail', [...code.matchAll(/stroke\('mztrail', ink\.trail,/g)].length === 1 && /\[0, 1\]\.map\(\(\) => stroke\('mztrail'/.test(code));
  ['mazeRng', 'makeMaze', 'mazeSolve', 'mazeWalker', 'mazePoint', 'mazeFollow', 'mazeLeave', 'mazeGo', 'mazePursue', 'mazeDist', 'mazeGap', 'mazeJoined', 'mazeSlide'].forEach(name => {
    const fnSrc = braceBlock(src, 'function ' + name + '(');
    t(name + ' touches no DOM and no state', !/\b(document|window|state|field|mz)\b/.test(fnSrc));
  });
  const css = [...src.matchAll(/(?:svg\.maze|\.mzpiece|\.mzsol)\s*\{[^}]*\}/g)].map(x => x[0]).join('\n');
  t('maze css rules exist', css.length > 0);
  t('maze css has no opacity, filter, shadow, background or border',
    !/opacity|filter|shadow|background|border|blend|backdrop/i.test(css));
  t('the svg paints nothing of its own (fill none, stroke none)', /svg\.maze\{[^}]*fill:none;[^}]*stroke:none/.test(src));
  t('no hit-area rect in the maze code', !/createElementNS\(SVGNS, 'rect'\)|<rect/.test(code));
  t('no frame or border drawn around the play surface for the maze', !/frame|border/i.test(code));

  console.log('  wiring');
  const gs = g.sanitize;
  const goodMaze = { mode:'maze', mazeN:6, mazeTrail:'dots', mazeWall:'medium', mazeShow:true, mazeSlow:false };
  t('mode "maze" and valid maze settings survive', JSON.stringify(gs(goodMaze)) === JSON.stringify(goodMaze));
  [['mazeN', 5], ['mazeN', '3'], ['mazeN', 0], ['mazeN', 12], ['mazeTrail', 'red'], ['mazeTrail', 'toString'],
   ['mazeWall', 'dark'], ['mazeWall', null], ['mazeShow', 1], ['mazeShow', 'yes'], ['mazeSlow', 0]
  ].forEach(([k, v]) => t('  ' + k + ' = ' + JSON.stringify(v) + ' is refused', !(k in gs({ [k]: v }))));
  t('#maze sets the mode and nothing else',
    /if \(location\.hash === '#maze'\)\{ state\.mode = 'maze'; return true; \}/.test(src));
}

suite('reference model', reference());
suite('eye-trainer.html', modelFrom('eye-trainer.html'));
suite('puzzle.html', modelFrom('puzzle.html'));
meterRolesSuite('eye-trainer.html', modelFrom('eye-trainer.html'));
meterRolesSuite('puzzle.html', modelFrom('puzzle.html'));
whiteFieldSuite('puzzle.html', modelFrom('puzzle.html', ['bestInk', 'rampEnds', 'rampInk']));
toneArtSuite('puzzle.html', modelFrom('puzzle.html', ['bestInk', 'rampEnds', 'rampInk']));
guardSuite('puzzle.html', guardsFrom('puzzle.html'), modelFrom('puzzle.html'));
mazeSuite('puzzle.html', modelFrom('puzzle.html', ['bestInk', 'rampEnds', 'rampInk', 'mazeInks', 'mazeRng', 'makeMaze', 'mazeSolve', 'mazeWalker', 'mazePoint', 'mazeFollow', 'mazeLeave', 'mazeGo', 'mazePursue', 'mazeDist', 'mazeGap', 'mazeJoined', 'mazeSlide']),
          guardsFrom('puzzle.html'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
