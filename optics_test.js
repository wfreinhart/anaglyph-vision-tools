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

  console.log('  traversal');
  let fastSafe = true, followed = true, backtracked = true, wallStops = true, wallsSeen = 0, hopsOk = true;
  const rnd = m.mazeRng(99);
  SIZES.forEach(n => {
    const cs = 60;
    for (let seed = 1; seed <= 60; seed++){
      const mz = m.makeMaze(n, seed);
      const ctr = i => ({ x:(i % n + 0.5) * cs, y:(Math.floor(i / n) + 0.5) * cs });

      /* A hostile finger: huge jumps all over (and off) the grid. */
      let trail = [mz.start], last = ctr(mz.start);
      for (let k = 0; k < 300; k++){
        const p = { x:(rnd() * 1.6 - 0.3) * n * cs, y:(rnd() * 1.6 - 0.3) * n * cs };
        m.mazeWalk(mz, trail, last, p, cs);
        last = p;
        if (!sound(mz, trail)) fastSafe = false;
      }

      /* Straight through every wall at each head along the route, from the
         cell centre and far past it. */
      const walk = m.mazeSolve(mz);
      for (let k = 0; k < walk.length; k++){
        const head = walk[k];
        trail = walk.slice(0, k + 1);
        const hc = ctr(head);
        [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]].forEach(d => {
          if (mz.open[head] & d[2]) return;
          wallsSeen++;
          const before = trail.slice();
          const r = m.mazeWalk(mz, trail, hc, { x:hc.x + d[0] * cs * 3, y:hc.y + d[1] * cs * 3 }, cs);
          /* Off the grid there is nothing to stop at; inside it the walk must say so. */
          const c = head % n + d[0], rr = Math.floor(head / n) + d[1];
          const inside = c >= 0 && c < n && rr >= 0 && rr < n;
          if (trail.join() !== before.join() || (inside && !r.blocked)) wallStops = false;
        });
      }

      /* One hop per cell along the route reaches the goal. */
      trail = [mz.start]; last = ctr(mz.start);
      walk.slice(1).forEach(i => { m.mazeWalk(mz, trail, last, ctr(i), cs); last = ctr(i); });
      if (trail.join() !== walk.join()) followed = false;

      /* Back along the route retracts it, step by step, and stops at the start. */
      for (let k = walk.length - 2; k >= 0; k--){
        m.mazeWalk(mz, trail, last, ctr(walk[k]), cs); last = ctr(walk[k]);
        if (trail.join() !== walk.slice(0, k + 1).join()) backtracked = false;
      }
      m.mazeWalk(mz, trail, last, { x:mz.start % n ? n * cs + 500 : -500, y:mz.start >= n ? n * cs + 500 : -500 }, cs);
      if (trail.join() !== String(mz.start)) backtracked = false;

      /* One huge flick from the start centre to the goal centre. */
      trail = [mz.start];
      m.mazeWalk(mz, trail, ctr(mz.start), ctr(mz.goal), cs);
      if (!sound(mz, trail)) hopsOk = false;
    }
  });
  t('a hostile finger (300 huge jumps per maze) never breaks the trail', fastSafe);
  t('a flick through ' + wallsSeen + ' walls stops dead at each', wallStops && wallsSeen > 0);
  t('one flick start to goal leaves a sound trail', hopsOk);
  t('hopping cell by cell along the route reaches the goal', followed);
  t('going back along the trail retracts it, down to the start', backtracked);

  /* Two characters: each trail starts at its own corner and a trail may not
     cross a wall; the only way onto the other trail is the joining move. */
  console.log('  two trails, joining');
  {
    let bothSafe = true, bothWalls = 0, meet = true, headHit = true, bodyHit = true, wallBlocks = true, retract = true, noEarly = true, branches = 0;
    SIZES.forEach(n => {
      const cs = 60, ctr = i => ({ x:(i % n + 0.5) * cs, y:(Math.floor(i / n) + 0.5) * cs });
      for (let seed = 1; seed <= 60; seed++){
        const mz = m.makeMaze(n, seed), route = m.mazeSolve(mz), L = route.length;
        const hop = (tr, other, cells) => {            // one hop per cell, like a finger moving cell to cell
          let last = ctr(tr[tr.length - 1]), res = null;
          cells.forEach(i => { res = m.mazeWalk(mz, tr, last, ctr(i), cs, other); last = ctr(i); });
          return res;
        };

        /* Hostile fingers on both characters at once, interleaved: both
           trails stay legal paths, disjoint until the walk reports a join. */
        let A = [mz.start], B = [mz.goal], lastA = ctr(mz.start), lastB = ctr(mz.goal), joined = false;
        const rnd2 = m.mazeRng(seed * 7 + n);
        for (let k = 0; k < 300 && !joined; k++){
          const p = { x:(rnd2() * 1.6 - 0.3) * n * cs, y:(rnd2() * 1.6 - 0.3) * n * cs };
          const useA = rnd2() < 0.5, mine = useA ? A : B, other = useA ? B : A;
          const r = m.mazeWalk(mz, mine, useA ? lastA : lastB, p, cs, other);
          if (useA) lastA = p; else lastB = p;
          if (!sound(mz, A)) bothSafe = false;
          const soundB = (() => { if (B[0] !== mz.goal) return false;
            for (let q = 1; q < B.length; q++) if (nb(mz, B[q - 1]).indexOf(B[q]) < 0) return false; return true; })();
          if (!soundB) bothSafe = false;
          const share = A.filter(c => B.indexOf(c) >= 0).length;
          if (r.joined){ joined = true; if (share !== 1 || !m.mazeJoined(mz, A, B)) bothSafe = false; }
          else if (share !== 0 || m.mazeJoined(mz, A, B)) noEarly = false;
        }

        /* Meet in the middle: A walks the first half, B the second half, then
           one more step either way joins. Until then nothing is joined. */
        if (L >= 4){
          const mid = Math.floor(L / 2) - 1;           // A reaches route[mid], B reaches route[mid + 2]
          const a = [mz.start], b = [mz.goal];
          hop(a, b, route.slice(1, mid + 1));
          hop(b, a, route.slice(mid + 2, L - 1).reverse());
          if (m.mazeJoined(mz, a, b)) noEarly = false;
          const r = hop(b, a, [route[mid + 1]]);        // adjacent, still apart
          if (r.joined || m.mazeJoined(mz, a, b)) noEarly = false;
          const r2 = hop(b, a, [route[mid]]);           // onto A's head
          if (!r2.joined || !m.mazeJoined(mz, a, b) || b[b.length - 1] !== route[mid]) headHit = false;
          if (a.join() !== route.slice(0, mid + 1).join()) meet = false;
        }
        /* Either character can do the whole job alone: A to B's head, B to A's head. */
        { const a = [mz.start], b = [mz.goal]; const r = hop(a, b, route.slice(1));
          if (!r.joined || a.join() !== route.join() || !m.mazeJoined(mz, a, b)) meet = false; }
        { const a = [mz.start], b = [mz.goal]; const r = hop(b, a, route.slice().reverse().slice(1));
          if (!r.joined || b.join() !== route.slice().reverse().join() || !m.mazeJoined(mz, b, a)) meet = false; }

        /* A cell in the middle of the other trail, not its head: B detours
           into a branch off the route, so A reaches B's body first. */
        for (let k = 1; k < L - 1; k++){
          const side = nb(mz, route[k]).find(c => route.indexOf(c) < 0);
          if (side === undefined) continue;
          branches++;
          const a = [mz.start], b = [mz.goal];
          hop(a, b, route.slice(1, k));
          hop(b, a, route.slice(k, L - 1).reverse());
          hop(b, a, [side]);
          if (m.mazeJoined(mz, a, b) || b.indexOf(route[k]) < 0 || b[b.length - 1] !== side) bodyHit = false;
          const r = hop(a, b, [route[k]]);
          if (!r.joined || !m.mazeJoined(mz, a, b) || a[a.length - 1] !== route[k] || b.indexOf(a[a.length - 1]) === b.length - 1) bodyHit = false;
          break;
        }

        /* No join through a wall: from each head on the route, a flick
           through a closed wall toward the other trail changes nothing and
           does not join. The other trail is the rest of the route. */
        for (let k = 1; k < L - 1; k++){
          const a = route.slice(0, k + 1), b = [route[L - 1]];
          hop(b, a, route.slice(k + 1, L - 1).reverse());
          const head = a[k];
          [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]].forEach(d => {
            if (mz.open[head] & d[2]) return;
            const c = head % n + d[0], rr = Math.floor(head / n) + d[1];
            if (c < 0 || c >= n || rr < 0 || rr >= n) return;
            const target = rr * n + c;
            if (b.indexOf(target) < 0) return;           // only walls that face the other trail
            bothWalls++;
            const before = a.slice(), hc = ctr(head);
            const r = m.mazeWalk(mz, a, hc, { x:hc.x + d[0] * cs * 3, y:hc.y + d[1] * cs * 3 }, cs, b);
            if (r.joined || a.join() !== before.join() || m.mazeJoined(mz, a, b) || !r.blocked) wallBlocks = false;
          });
        }

        /* Retraction undoes progress: walk out, walk back, and nothing is
           joined or left over, even next to the other trail. */
        if (L >= 6){
          const a = [mz.start], b = [mz.goal];
          hop(b, a, route.slice(L - 3, L - 1).reverse());     // B two cells in
          hop(a, b, route.slice(1, 3));
          hop(a, b, [route[1]]);
          hop(a, b, [route[0]]);
          if (a.join() !== String(mz.start) || m.mazeJoined(mz, a, b)) retract = false;
        }
      }
    });
    t('both trails stay legal paths and disjoint until they join, under hostile fingers', bothSafe && noEarly);
    t('meeting in the middle: the last step onto the other head joins them', meet && headHit);
    t('one character alone can reach the other, from either end', meet);
    t('stepping onto a cell in the middle of the other trail joins (' + branches + ' branch cases)', bodyHit && branches > 20);
    t('a flick through ' + bothWalls + ' walls that face the other trail never joins', wallBlocks && bothWalls > 20);
    t('retracting a trail undoes its progress, and nothing is joined', retract);
    t('mazeJoined: shared cell only', m.mazeJoined({}, [1, 2, 3], [9, 8]) === false && m.mazeJoined({}, [1, 2, 3], [9, 3]) === true &&
      m.mazeJoined({}, [4], [4]) === true);
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
  ['mazeRng', 'makeMaze', 'mazeSolve', 'mazeWalk', 'mazeJoined'].forEach(name => {
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
mazeSuite('puzzle.html', modelFrom('puzzle.html', ['bestInk', 'rampEnds', 'rampInk', 'mazeInks', 'mazeRng', 'makeMaze', 'mazeSolve', 'mazeWalk', 'mazeJoined']),
          guardsFrom('puzzle.html'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
