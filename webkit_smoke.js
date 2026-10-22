// Maze mode smoke test: Playwright WebKit with touch, EMULATED.
//
// This is regression evidence on a WebKit engine with a touch-capable
// context, not iPad Safari and not a finger. Pointer streams are synthesised
// PointerEvents (Playwright's WebKit has no touch-drag API); taps on the
// settings sheet are real touchscreen taps. Eye separation cannot be shown
// here at all: the real iPad cover-one-eye check is still Wes's.
//
//   node webkit_smoke.js            (needs `playwright` resolvable, e.g. 1.61.x
//                                    for the webkit-2311 build on the Air)
//
// Covers docs/maze.md "Done means" item 3: every paint inside the field is on
// the round eye's ramp; a fast swipe cannot cross a wall; backtracking;
// the solution toggle and its animation; completion fires the reward;
// pointercancel, a stray release and a viewport resize all recover.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { webkit } = require('playwright');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && extra !== undefined ? '   [' + extra + ']' : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- a tiny static server: localStorage needs a real origin ---------- */
const server = http.createServer((req, res) => {
  const file = path.join(__dirname, req.url.split('#')[0].split('?')[0].replace(/^\/+/, '') || 'puzzle.html');
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

/* ---------- settings the page is seeded with ---------- */
const CAL = {
  std:  { red:'#ff0000', green:'#00ff00', pair:'green', bluePass:0, redBlue:0, redSide:'L' },
  // the measured pair from the optics tests
  meas: { red:'#ff2ecb', green:'#2effe7', pair:'cyan', bluePass:1, redBlue:0, redSide:'L' }
};
/* On the white field the red-lens eye is given the second ink. */
const inkOf = (cal, eye) => eye === cal.redSide ? cal.green : cal.red;

async function openPage(browser, cfg, hash){
  const ctx = await browser.newContext({
    viewport: cfg.viewport || { width:820, height:1180 }, hasTouch:true, isMobile:true, deviceScaleFactor:2
  });
  const game = Object.assign({ mode:'maze', eyePlan:'L', mazeN:3, mazeTrail:'line', mazeWall:'full',
                               mazeShow:false, mazeSlow:true, sound:false }, cfg.game || {});
  const calib = cfg.cal || CAL.std;
  await ctx.addInitScript(([g, c]) => {
    try{
      localStorage.setItem('anaglyph.puzzle.v1', JSON.stringify(g));
      localStorage.setItem('anaglyph.calib.v1', JSON.stringify(c));
    }catch(_){}
  }, [game, calib]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto('http://127.0.0.1:' + server.address().port + '/puzzle.html' + (hash === undefined ? '#maze' : hash));
  await page.waitForSelector('svg.maze', { timeout:5000 });
  page.ctx = ctx;
  return page;
}

/* ---------- reading the page ---------- */
const info = page => page.evaluate(() => {
  const s = document.querySelector('svg.maze');
  if (!s) return null;
  const r = s.getBoundingClientRect(), vb = s.viewBox.baseVal;
  const pieces = document.querySelectorAll('.mzchar'), mv = pieces[0], gl = pieces[1];   // A starts at `start`, B at `goal`
  const box = e => { const b = e.getBoundingClientRect(); return { x:b.left + b.width / 2, y:b.top + b.height / 2, w:b.width }; };
  return {
    n:Number(s.dataset.n), cs:Number(s.dataset.cs), open:s.dataset.open.split(',').map(Number),
    start:Number(s.dataset.start), goal:Number(s.dataset.goal), trail:s.dataset.trailA.split(',').map(Number), trailB:s.dataset.trailB.split(',').map(Number),
    left:r.left - vb.x, top:r.top - vb.y,          // client position of the maze's own (0,0)
    mover:mv ? box(mv) : null, goalEl:gl ? box(gl) : null, moverShape:mv && mv.dataset.shape, goalShape:gl && gl.dataset.shape
  };
});
const ctr = (I, cell) => ({ x:I.left + (cell % I.n + 0.5) * I.cs, y:I.top + (Math.floor(cell / I.n) + 0.5) * I.cs });
const D = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];

/* The solution, found here independently of the page. */
function solve(I){
  const prev = new Array(I.n * I.n).fill(-1), q = [I.start];
  prev[I.start] = I.start;
  for (let k = 0; k < q.length; k++){
    const at = q[k];
    D.forEach(d => {
      if (!(I.open[at] & d[2])) return;
      const to = (Math.floor(at / I.n) + d[1]) * I.n + (at % I.n) + d[0];
      if (prev[to] < 0){ prev[to] = at; q.push(to); }
    });
  }
  const p = [I.goal];
  while (p[0] !== I.start) p.unshift(prev[p[0]]);
  return p;
}
const sound = I => {                                   // trail: each step an open passage, no repeats
  const tr = I.trail;
  if (tr[0] !== I.start || new Set(tr).size !== tr.length) return false;
  for (let k = 1; k < tr.length; k++){
    const a = tr[k - 1], b = tr[k];
    const ok = D.some(d => (I.open[a] & d[2]) && (Math.floor(a / I.n) + d[1]) * I.n + (a % I.n) + d[0] === b);
    if (!ok) return false;
  }
  return true;
};

/* ---------- synthetic pointer stream ---------- */
const fire = (page, type, p, target, id) => page.evaluate(([type, p, target, id]) => {
  const el = target === 'body' ? document.body : document.querySelector(target);
  el.dispatchEvent(new PointerEvent(type, {
    pointerId:id, pointerType:'touch', isPrimary:true, bubbles:true, cancelable:true,
    clientX:p.x, clientY:p.y, buttons:(type === 'pointerup' || type === 'pointercancel') ? 0 : 1
  }));
}, [type, p, target || 'svg.maze', id || 7]);
const down = (page, p) => fire(page, 'pointerdown', p);
const move = (page, p) => fire(page, 'pointermove', p);
const up   = (page, p) => fire(page, 'pointerup', p);

/* Grab the mover and hop to each listed cell centre, one move per cell. */
async function hop(page, I, cells, release, fromB){
  const tr = fromB ? I.trailB : I.trail;
  await down(page, ctr(I, tr[tr.length - 1]));
  for (const c of cells) await move(page, ctr(I, c));
  if (release !== false) await up(page, ctr(I, cells.length ? cells[cells.length - 1] : I.start));
}

/* ---------- ramp audit: every paint inside the field ---------- */
function parseColor(v){
  if (v === 'none' || v === 'transparent') return { none:true };
  let m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m){
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    if (p.length > 3 && p[3] === 0) return { none:true };
    return { r:p[0], g:p[1], b:p[2], a:p.length > 3 ? p[3] : 1 };
  }
  m = v.match(/^color\(srgb ([^)]+)\)$/);
  if (m){
    const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number);
    if (p.length > 3 && p[3] === 0) return { none:true };
    return { r:p[0] * 255, g:p[1] * 255, b:p[2] * 255, a:p.length > 3 ? p[3] : 1 };
  }
  return { bad:v };
}
const hexRgb = h => ({ r:parseInt(h.slice(1, 3), 16), g:parseInt(h.slice(3, 5), 16), b:parseInt(h.slice(5, 7), 16) });
/* On the ramp: a point on the straight line from the field (white) to the
   eye's ink, to within rounding. */
function onRamp(c, ink){
  const a = { r:255, g:255, b:255 }, b = hexRgb(ink);
  const v = [b.r - a.r, b.g - a.g, b.b - a.b], len2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  const k = ((c.r - a.r) * v[0] + (c.g - a.g) * v[1] + (c.b - a.b) * v[2]) / len2;
  if (k < -0.01 || k > 1.01) return { ok:false, why:'t=' + k.toFixed(3) };
  const dev = Math.max(Math.abs(c.r - (a.r + v[0] * k)), Math.abs(c.g - (a.g + v[1] * k)), Math.abs(c.b - (a.b + v[2] * k)));
  return { ok:dev <= 1.6 && (c.a === undefined || c.a === 1), why:'dev=' + dev.toFixed(2) + ' a=' + c.a, k };
}

async function audit(page, ink, label){
  const recs = await page.evaluate(() => {
    const out = [], geo = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline', 'svg']);
    document.getElementById('field').querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el), tag = el.tagName.toLowerCase();
      const rec = { tag:tag, cls:String(el.getAttribute('class') || ''), paints:[], flags:[] };
      if (el instanceof SVGElement){
        if (geo.has(tag)) rec.paints.push(['fill', cs.fill], ['stroke', cs.stroke]);
      } else {
        rec.paints.push(['background', cs.backgroundColor]);
        ['Top', 'Right', 'Bottom', 'Left'].forEach(s => {
          if (parseFloat(cs['border' + s + 'Width']) > 0) rec.paints.push(['border' + s, cs['border' + s + 'Color']]);
        });
      }
      if (cs.opacity !== '1') rec.flags.push('opacity ' + cs.opacity);
      if (cs.filter && cs.filter !== 'none') rec.flags.push('filter ' + cs.filter);
      if (cs.boxShadow && cs.boxShadow !== 'none') rec.flags.push('box-shadow');
      if (cs.textShadow && cs.textShadow !== 'none') rec.flags.push('text-shadow');
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') rec.flags.push('blend ' + cs.mixBlendMode);
      const bd = cs.webkitBackdropFilter || cs.backdropFilter;
      if (bd && bd !== 'none') rec.flags.push('backdrop ' + bd);
      if (cs.webkitMaskImage && cs.webkitMaskImage !== 'none') rec.flags.push('mask');
      out.push(rec);
    });
    return out;
  });
  let paints = 0, bad = [], flags = [], nonTrivial = 0, hasInk = false;
  recs.forEach(r => {
    r.flags.forEach(f => flags.push(r.tag + '.' + r.cls + ' ' + f));
    r.paints.forEach(([prop, val]) => {
      const c = parseColor(val);
      if (c.none) return;
      paints++;
      if (c.bad){ bad.push(r.tag + '.' + r.cls + ' ' + prop + ' ' + val); return; }
      const o = onRamp(c, ink);
      if (!o.ok) bad.push(r.tag + '.' + r.cls + ' ' + prop + ' ' + val + ' (' + o.why + ')');
      else if (o.k > 0.99) hasInk = true;
      if (o.ok && o.k > 0.02) nonTrivial++;
    });
  });
  t(label + ': ' + paints + ' paints in the field, all on the eye\'s ramp', bad.length === 0 && paints > 0, bad.slice(0, 3).join(' | '));
  t(label + ': no opacity, filter, shadow, blend, mask or backdrop on any field element', flags.length === 0, flags.slice(0, 3).join(' | '));
  t(label + ': the full ink is actually used (walls or pieces)', hasInk && nonTrivial > 0);
  return recs;
}

/* ---------- panel helpers (real touchscreen taps) ---------- */
async function openSheet(page){
  await page.locator('#gear').tap();
  await page.waitForFunction(() => document.getElementById('panel').classList.contains('on'));
  await sleep(350);
}
async function closeSheet(page){
  await page.locator('#done').tap();
  await sleep(350);
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await webkit.launch();
  const ua = await (async () => { const p = await browser.newPage(); const u = await p.evaluate(() => navigator.userAgent); await p.close(); return u; })();
  console.log('Maze smoke (EMULATED: Playwright WebKit, touch context, synthetic pointer stream)\n' + ua);

  /* ===== 1. every paint on the eye's ramp: both eyes, both calibrations, every look ===== */
  console.log('\nramp audit');
  const looks = [
    { name:'line/full',   game:{ mazeTrail:'line',  mazeWall:'full'   } },
    { name:'light/medium + the way', game:{ mazeTrail:'light', mazeWall:'medium', mazeShow:true, mazeSlow:false } },
    { name:'dots/full + the way',    game:{ mazeTrail:'dots',  mazeWall:'full',   mazeShow:true, mazeSlow:false, mazeN:6 } }
  ];
  for (const calName of Object.keys(CAL)) for (const eye of ['L', 'R']) for (const look of looks){
    const page = await openPage(browser, { cal:CAL[calName], game:Object.assign({ eyePlan:eye }, look.game) });
    let I = await info(page);
    const sol = solve(I);
    await hop(page, I, sol.slice(1, Math.max(2, Math.ceil(sol.length / 2))));   // some trail on screen
    I = await info(page);
    await hop(page, I, [sol[sol.length - 2]], true, true);                      // and a first step from the other character
    const ink = inkOf(CAL[calName], eye);
    await audit(page, ink, calName + ' ' + eye + ' ' + look.name);
    t(calName + ' ' + eye + ' ' + look.name + ': no page errors', page.errors.length === 0, page.errors.join(' | '));
    await page.ctx.close();
  }
  {
    // eye plan "both" is the warm-up: black on white, still one ink
    const page = await openPage(browser, { game:{ eyePlan:'both' } });
    await audit(page, '#000000', 'both-eye warm-up');
    await page.ctx.close();
  }

  /* ===== 2. fast swipes cannot cross a wall ===== */
  console.log('\nfast swipe vs walls');
  {
    const page = await openPage(browser, { game:{ mazeN:6 } });
    let I = await info(page);
    const sol = solve(I);
    let flicks = 0, held = true, sane = true;
    for (let k = 0; k < sol.length && flicks < 12; k++){
      I = await info(page);
      const head = I.trail[I.trail.length - 1];
      // bring the head to solution cell k, one cell per move
      if (head !== sol[k]) await hop(page, I, [sol[k]]);
      I = await info(page);
      const hc = ctr(I, sol[k]);
      for (const d of D){
        const r = Math.floor(sol[k] / I.n) + d[1], c = sol[k] % I.n + d[0];
        if ((I.open[sol[k]] & d[2]) || r < 0 || r >= I.n || c < 0 || c >= I.n) continue;
        // one jump of three cells straight through the wall
        const before = I.trail.join();
        await down(page, hc);
        await move(page, { x:hc.x + d[0] * I.cs * 3, y:hc.y + d[1] * I.cs * 3 });
        await up(page, { x:hc.x + d[0] * I.cs * 3, y:hc.y + d[1] * I.cs * 3 });
        const J = await info(page);
        flicks++;
        if (J.trail.join() !== before) held = false;
        if (!sound(J)) sane = false;
      }
    }
    t('a one-move flick straight through ' + flicks + ' different walls leaves the trail where it was', held && flicks >= 6, flicks);
    t('the trail stayed a legal path throughout', sane);
    // one huge flick start to goal in a fresh maze
    await page.keyboard.press('n');
    await sleep(100);
    I = await info(page);
    await down(page, ctr(I, I.start));
    await move(page, ctr(I, I.goal));
    await up(page, ctr(I, I.goal));
    const J = await info(page);
    t('a single flick from start to goal corner leaves a legal trail', sound(J));
    // fast zig-zag over the whole field
    await down(page, ctr(J, J.trail[J.trail.length - 1]));
    for (let k = 0; k < 40; k++) await move(page, { x:J.left + ((k * 37) % 100) / 100 * J.n * J.cs, y:J.top + ((k * 61) % 100) / 100 * J.n * J.cs });
    await up(page, ctr(J, J.start));
    t('forty wild jumps still leave a legal trail', sound(await info(page)));
    t('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await page.ctx.close();
  }

  /* ===== 3. backtracking, mover on the head ===== */
  console.log('\nbacktracking');
  {
    const page = await openPage(browser, { game:{ mazeN:4 } });
    let I = await info(page);
    const sol = solve(I), k = Math.min(4, sol.length - 2);
    await hop(page, I, sol.slice(1, k + 1));
    I = await info(page);
    t('forward along the route grows the trail', I.trail.join() === sol.slice(0, k + 1).join());
    const at = ctr(I, I.trail[I.trail.length - 1]);
    t('the mover sits on the trail head', Math.hypot(I.mover.x - at.x, I.mover.y - at.y) < 1.5, JSON.stringify([I.mover, at]));
    await hop(page, I, [sol[k - 1]]);
    I = await info(page);
    t('stepping back onto the previous cell retracts one cell', I.trail.join() === sol.slice(0, k).join(), I.trail.join());
    const at2 = ctr(I, I.trail[I.trail.length - 1]);
    t('and the mover follows it back', Math.hypot(I.mover.x - at2.x, I.mover.y - at2.y) < 1.5);
    await hop(page, I, sol.slice(0, k - 1).reverse());
    I = await info(page);
    t('all the way back leaves just the start', I.trail.join() === String(I.start), I.trail.join());
    await hop(page, I, [sol[1], sol[2]]);
    I = await info(page);
    t('and it can go forward again', I.trail.join() === sol.slice(0, 3).join());
    // swipe back-and-forth inside one stroke: down, forward, back, in one pointer
    await down(page, ctr(I, sol[2]));
    await move(page, ctr(I, sol[3]));
    await move(page, ctr(I, sol[2]));
    await move(page, ctr(I, sol[1]));
    await up(page, ctr(I, sol[1]));
    I = await info(page);
    t('forward then back in one stroke ends one cell behind where it started', I.trail.join() === sol.slice(0, 2).join(), I.trail.join());
    // the mover is bigger than the trail line and smaller than a corridor
    t('the mover is smaller than a cell', I.mover.w < I.cs && I.mover.w > I.cs * 0.4, I.mover.w + ' vs ' + I.cs);
    t('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await page.ctx.close();
  }

  /* ===== 4. the way: toggle and slow draw ===== */
  console.log('\nshow the way');
  {
    const page = await openPage(browser, { game:{ mazeN:3 } });
    let I = await info(page);
    t('off by default: no solution path drawn', await page.locator('.mzsol').count() === 0);
    await openSheet(page);
    t('the Maze rows are showing', await page.locator('#mazeShowRow').isVisible() && await page.locator('#mazeSizeRow').isVisible());
    t('Draw it slowly is greyed while the way is off', await page.evaluate(() => document.getElementById('mazeSlowRow').classList.contains('off')));
    await page.locator('#mazeShow').tap();
    t('the toggle reads on', await page.getAttribute('#mazeShow', 'aria-checked') === 'true');
    await page.waitForSelector('.mzsol');
    const sample = () => page.evaluate(() => {
      const p = document.querySelector('.mzsol'), cs = getComputedStyle(p);
      return { off:parseFloat(cs.strokeDashoffset), arr:cs.strokeDasharray, stroke:cs.stroke, sw:parseFloat(cs.strokeWidth), d:p.getAttribute('d') };
    });
    const s0 = await sample();
    await sleep(500);
    const s1 = await sample();
    await sleep(500);
    const s2 = await sample();
    t('the slow draw starts hidden or nearly, then moves', s0.off > 0 && (s1.off < s0.off) && (s2.off < s1.off), [s0.off, s1.off, s2.off].join(' > '));
    I = await info(page);
    const sol = solve(I);
    const secs = (sol.length - 1) * 0.5;
    await sleep(secs * 1000 + 600);
    const sEnd = await sample();
    t('and finishes fully drawn', sEnd.off === 0, sEnd.off);
    // the path is the solution through cell centres, in one colour, narrower than the corridor
    const rel = I2 => sol.map(c => ((c % I2.n + 0.5) * I2.cs).toFixed(1) + ' ' + ((Math.floor(c / I2.n) + 0.5) * I2.cs).toFixed(1));
    const nums = sEnd.d.match(/-?[\d.]+/g).map(Number), got = [];
    for (let k = 0; k < nums.length; k += 2) got.push(nums[k].toFixed(1) + ' ' + nums[k + 1].toFixed(1));
    t('the drawn path runs through the solution cells, start to goal', got.join('|') === rel(I).join('|'));
    t('it is narrower than a corridor (never touches a wall)', sEnd.sw < I.cs * 0.9 - 4 && sEnd.sw >= 3, sEnd.sw);
    const c0 = parseColor(sEnd.stroke), c1 = parseColor(s0.stroke);
    t('same colour throughout the animation', c0.r === c1.r && c0.g === c1.g && c0.b === c1.b, [s0.stroke, sEnd.stroke].join(' / '));
    t('solution tone is the eye\'s ink at about 0.45', Math.abs(onRamp(c0, inkOf(CAL.std, 'L')).k - 0.45) < 0.03, onRamp(c0, inkOf(CAL.std, 'L')).k);
    // turning the slow draw off shows it at once
    await page.locator('#mazeSlow').tap();
    const sNow = await sample();
    t('with Draw it slowly off the way appears at once', sNow.off === 0 && (sNow.arr === 'none' || sNow.arr === ''), JSON.stringify(sNow));
    await closeSheet(page);
    I = await info(page);
    t('after closing the sheet the next maze shows the way too', await page.locator('.mzsol').count() === 1);
    await audit(page, inkOf(CAL.std, 'L'), 'way on, plain draw');
    // and hides it again
    await openSheet(page);
    await page.locator('#mazeShow').tap();
    t('toggling it off removes the path', await page.locator('.mzsol').count() === 0);
    await closeSheet(page);
    t('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await page.ctx.close();
  }

  /* ===== 5. completion: reward, then the next maze (eye flips under Alternate) ===== */
  console.log('\ncompletion');
  {
    const page = await openPage(browser, { game:{ eyePlan:'alt', mazeN:3 } });
    let I = await info(page);
    const wallInk = () => page.evaluate(() => getComputedStyle(document.querySelector('.mzwall')).stroke);
    const eye0 = await wallInk();
    t('before the goal: no reward on screen', await page.locator('#burst span').count() === 0);
    t('before the goal: tally reads 0', (await page.textContent('#hitCount')) === '0');
    const sol = solve(I);
    await hop(page, I, sol.slice(1, sol.length - 1));
    t('one cell short of the goal: still no reward', await page.locator('#burst span').count() === 0);
    I = await info(page);
    await down(page, ctr(I, sol[sol.length - 2]));
    await move(page, ctr(I, sol[sol.length - 1]));
    await sleep(60);
    const burst = await page.evaluate(() => [...document.querySelectorAll('#burst span')].map(s => getComputedStyle(s).color));
    t('reaching the goal fires the reward (16 pieces)', burst.length === 16, burst.length);
    t('the reward is binocular ink (black on white), only after the goal', burst.every(c => c === 'rgb(0, 0, 0)'), burst[0]);
    t('the tally counts it', (await page.textContent('#hitCount')) === '1');
    const J = await info(page);
    t('the mover finished on the goal', Math.hypot(J.mover.x - J.goalEl.x, J.mover.y - J.goalEl.y) < 1.5);
    await up(page, ctr(I, I.goal));
    // dragging during the celebration does nothing
    const trail1 = (await info(page)).trail.join();
    await down(page, ctr(J, J.goal));
    await move(page, ctr(J, sol[sol.length - 2]));
    await up(page, ctr(J, sol[sol.length - 2]));
    t('the finished maze ignores the finger while the reward plays', (await info(page)).trail.join() === trail1);
    await sleep(1700);
    const K = await info(page);
    t('then a fresh maze appears, trail reset', K.trail.length === 1 && K.trail[0] === K.start);
    const eye1 = await wallInk();
    t('Alternate flips the eye for the next maze', eye0 !== eye1, eye0 + ' vs ' + eye1);
    await audit(page, inkOf(CAL.std, 'R'), 'next maze (right eye)');
    t('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await page.ctx.close();
  }

  /* ===== 6. recovery: cancel, stray release, panel, mode change, resize ===== */
  console.log('\nrecovery');
  {
    const page = await openPage(browser, { game:{ mazeN:4 } });
    let I = await info(page);
    const sol = solve(I);
    const abortsOf = () => page.evaluate(() => JSON.stringify(window.dragAborts));

    // pointercancel mid-drag: no scoring, trail kept, next grab works
    await hop(page, I, sol.slice(1, 3), false);
    await fire(page, 'pointercancel', ctr(I, sol[2]));
    I = await info(page);
    t('pointercancel keeps the trail and the mover on its head', I.trail.join() === sol.slice(0, 3).join() &&
      Math.hypot(I.mover.x - ctr(I, sol[2]).x, I.mover.y - ctr(I, sol[2]).y) < 1.5);
    t('pointercancel does not score', (await page.textContent('#hitCount')) === '0');
    await hop(page, I, [sol[3]]);
    I = await info(page);
    t('and the mover can be grabbed again straight away', I.trail.join() === sol.slice(0, 4).join(), I.trail.join());

    // release outside the maze's own element (capture never acquired)
    await down(page, ctr(I, sol[3]));
    await fire(page, 'pointerup', { x:5, y:5 }, 'body');
    t('a release that lands elsewhere is caught by the backstop', (await abortsOf()).indexOf('stray-up') >= 0, await abortsOf());
    await hop(page, I, [sol[2]]);
    I = await info(page);
    t('and the next grab works (retracts one)', I.trail.join() === sol.slice(0, 3).join(), I.trail.join());

    // opening the sheet under a held finger releases it
    await down(page, ctr(I, sol[2]));
    await page.locator('#gear').tap();
    await sleep(350);
    t('opening the sheet mid-drag aborts the drag by reason', (await abortsOf()).indexOf('panel') >= 0, await abortsOf());
    // change mode and back
    await page.locator('#modeChips [data-mode="tap"]').tap();
    await sleep(100);
    t('another mode replaces the maze', await page.locator('svg.maze').count() === 0 && await page.locator('.target').count() >= 1);
    await page.locator('#modeChips [data-mode="maze"]').tap();
    await sleep(100);
    await closeSheet(page);
    I = await info(page);
    t('back in Maze: a fresh maze, trail reset, nothing stuck', I && I.trail.length === 1);
    await hop(page, I, solve(I).slice(1, 3));
    t('and it can be dragged', (await info(page)).trail.length === 3);

    // resize with no finger down keeps the maze and the trail
    I = await info(page);
    const keep = I.trail.join(), keepOpen = I.open.join();
    await page.setViewportSize({ width:1180, height:820 });
    await sleep(600);
    let R = await info(page);
    t('rotating the iPad keeps the same maze and the same trail', R.open.join() === keepOpen && R.trail.join() === keep, R.trail.join());
    t('and lays it out again for the new size', R.cs !== I.cs || R.left !== I.left, [I.cs, R.cs].join('>'));
    const at = ctr(R, R.trail[R.trail.length - 1]);
    t('the mover is on its head after the relayout', Math.hypot(R.mover.x - at.x, R.mover.y - at.y) < 1.5);
    t('the maze sits inside the viewport', R.left > 0 && R.top > 0 && R.left + R.n * R.cs < 1180 && R.top + R.n * R.cs < 820, JSON.stringify([R.left, R.top, R.cs]));
    await audit(page, inkOf(CAL.std, 'L'), 'after rotate');
    const s2 = solve(R), have = R.trail.length;
    await hop(page, R, s2.slice(have, have + 1));
    t('and it can be dragged on', (await info(page)).trail.length === have + 1);

    // resize with a finger down: waits for the release, then recovers
    I = await info(page);
    await down(page, ctr(I, I.trail[I.trail.length - 1]));
    const keep2 = I.trail.join();
    await page.setViewportSize({ width:820, height:1180 });
    await sleep(700);
    const mid = await info(page);
    t('resize under a held finger waits (the maze is not rebuilt under it)', mid.cs === I.cs && mid.trail.join() === keep2);
    await fire(page, 'pointercancel', ctr(I, I.trail[I.trail.length - 1]));
    await sleep(700);
    R = await info(page);
    t('after the release the layout catches up and the trail survives', R.cs !== I.cs && R.trail.join() === keep2, [I.cs, R.cs, R.trail.join()].join(' '));
    const s3 = solve(R);
    await hop(page, R, s3.slice(R.trail.length, R.trail.length + 1));
    t('and the mover can be grabbed again', (await info(page)).trail.length === R.trail.length + 1);
    t('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await page.ctx.close();
  }

  /* ===== 7. #maze opens Maze and leaves the saved choices alone ===== */
  console.log('\n#maze hash');
  {
    const page = await openPage(browser, { game:{ mode:'jigsaw', eyePlan:'R', packs:['animals'], mazeN:4 } });
    const I = await info(page);
    t('#maze opens Maze although Jigsaw was saved', !!I && I.n === 4);
    t('a saved eye plan is not overridden (right eye only)', (await page.evaluate(() => getComputedStyle(document.querySelector('.mzwall')).stroke)) === 'rgb(255, 0, 0)');
    t('a saved pack choice is not overridden (Animals)', ['bear', 'bunny', 'duck'].indexOf(I.moverShape) >= 0 && ['bear', 'bunny', 'duck'].indexOf(I.goalShape) >= 0, I.moverShape + ',' + I.goalShape);
    await page.ctx.close();
  }

  /* ===== 8. either character can be dragged; the maze is solved when the trails join ===== */
  console.log('\nthe second character');
  const legal = (I, tr, from) => {
    if (tr[0] !== from || new Set(tr).size !== tr.length) return false;
    for (let k = 1; k < tr.length; k++){
      const a = tr[k - 1], b = tr[k];
      if (!D.some(d => (I.open[a] & d[2]) && (Math.floor(a / I.n) + d[1]) * I.n + (a % I.n) + d[0] === b)) return false;
    }
    return true;
  };
  for (const n of [3, 6]){
    const page = await openPage(browser, { game:{ mazeN:n } });
    let I = await info(page);
    const sol = solve(I), rev = sol.slice().reverse();
    t(n + 'x' + n + ': the two characters start in opposite corners, each trail at its own corner',
      I.trail.join() === String(I.start) && I.trailB.join() === String(I.goal) &&
      Math.hypot(I.mover.x - ctr(I, I.start).x, I.mover.y - ctr(I, I.start).y) < 1.5 &&
      Math.hypot(I.goalEl.x - ctr(I, I.goal).x, I.goalEl.y - ctr(I, I.goal).y) < 1.5);
    // grab the goal-corner character and walk part of the way
    await hop(page, I, rev.slice(1, 3), true, true);
    I = await info(page);
    t(n + 'x' + n + ': grabbing the goal-corner character walks its own trail', I.trailB.join() === rev.slice(0, 3).join(), I.trailB.join());
    t(n + 'x' + n + ': the other character stayed put', I.trail.join() === String(I.start));
    const atB = ctr(I, I.trailB[I.trailB.length - 1]);
    t(n + 'x' + n + ': it sits on its trail head', Math.hypot(I.goalEl.x - atB.x, I.goalEl.y - atB.y) < 1.5);
    // a flick through a wall from its head does nothing
    const head = I.trailB[I.trailB.length - 1], hc = ctr(I, head);
    let flicked = 0, held = true;
    for (const d of D){
      const r = Math.floor(head / I.n) + d[1], c = head % I.n + d[0];
      if ((I.open[head] & d[2]) || r < 0 || r >= I.n || c < 0 || c >= I.n) continue;
      const before = I.trailB.join(), to = { x:hc.x + d[0] * I.cs * 3, y:hc.y + d[1] * I.cs * 3 };
      await down(page, hc); await move(page, to); await up(page, to);
      flicked++;
      if ((await info(page)).trailB.join() !== before) held = false;
    }
    t(n + 'x' + n + ': a flick through a wall does not move the second trail (' + flicked + ' walls)', held && (n === 3 || flicked > 0));
    // finish from this end: walks onto the other character at the start corner
    I = await info(page);
    await hop(page, I, rev.slice(3), false, true);
    await sleep(60);
    I = await info(page);
    t(n + 'x' + n + ': solving from the goal end joins the trails and fires the reward',
      I.trailB[I.trailB.length - 1] === I.start && legal(I, I.trailB, I.goal) && (await page.locator('#burst span').count()) === 16 &&
      (await page.textContent('#hitCount')) === '1', I.trailB.join());
    await page.ctx.close();
  }
  {
    // meet in the middle: A walks the first half, B the second, then B steps onto A's head
    const page = await openPage(browser, { game:{ mazeN:6 } });
    let I = await info(page);
    const sol = solve(I), m = Math.floor(sol.length / 2) - 1;
    await hop(page, I, sol.slice(1, m + 1));
    I = await info(page);
    await hop(page, I, sol.slice(m + 2, sol.length - 1).reverse(), true, true);
    I = await info(page);
    t('two trails with one empty cell between: not solved yet', I.trailB[I.trailB.length - 1] === sol[m + 2] && (await page.locator('#burst span').count()) === 0 &&
      (await page.textContent('#hitCount')) === '0', I.trailB.join());
    t('both trails are legal and disjoint', legal(I, I.trail, I.start) && legal(I, I.trailB, I.goal) && !I.trail.some(c => I.trailB.indexOf(c) >= 0));
    await audit(page, inkOf(CAL.std, 'L'), 'two trails on screen');
    await hop(page, I, [sol[m + 1]], true, true);
    I = await info(page);
    t('right next to each other (head to head, no step between): still not solved', I.trailB[I.trailB.length - 1] === sol[m + 1] && (await page.textContent('#hitCount')) === '0');
    await hop(page, I, [sol[m]], false, true);
    await sleep(60);
    t('stepping onto the other head solves it (tally 1, reward fired)', (await page.textContent('#hitCount')) === '1' && (await page.locator('#burst span').count()) === 16);
    await sleep(1700);
    const K = await info(page);
    t('then a fresh maze with both trails reset', K.trail.length === 1 && K.trailB.length === 1 && K.trail[0] === K.start && K.trailB[0] === K.goal);
    t('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await page.ctx.close();
  }
  {
    // one reaches the other's trail body (not its head): B detours into a side branch off the
    // route, so its trail passes through route cell sol[k] while its head is elsewhere
    const page = await openPage(browser, { game:{ mazeN:6 } });
    let found = null, I, sol;
    for (let tries = 0; tries < 12 && !found; tries++){
      I = await info(page); sol = solve(I);
      for (let k = 1; k < sol.length - 1 && !found; k++){
        for (const d of D){
          const to = (Math.floor(sol[k] / I.n) + d[1]) * I.n + (sol[k] % I.n) + d[0];
          if ((I.open[sol[k]] & d[2]) && sol.indexOf(to) < 0){ found = { k:k, side:to }; break; }
        }
      }
      if (!found){ await page.keyboard.press('n'); await sleep(100); }
    }
    t('found a maze with a side branch off the route', !!found);
    if (found){
      const k = found.k;
      await hop(page, I, sol.slice(1, k), true, false);                        // A to sol[k-1]
      I = await info(page);
      await hop(page, I, sol.slice(k, sol.length - 1).reverse().concat([found.side]), true, true);   // B round the corner
      I = await info(page);
      t('B\'s head is off the route and its body passes the cell next to A',
        I.trailB[I.trailB.length - 1] === found.side && I.trailB.indexOf(sol[k]) >= 0 && (await page.textContent('#hitCount')) === '0', I.trailB.join());
      await hop(page, I, [sol[k]], false, false);
      await sleep(60);
      t('A stepping onto a cell in the middle of B\'s trail joins them',
        (await page.textContent('#hitCount')) === '1' && (await page.locator('#burst span').count()) === 16);
    }
    await page.ctx.close();
  }
  {
    // hit testing: nearest head wins when both are in range; empty ground grabs nothing
    const page = await openPage(browser, { game:{ mazeN:3 } });
    let I = await info(page);
    const a = ctr(I, I.start), far = ctr(I, I.n + 1);
    await down(page, far); await move(page, ctr(I, I.n + 2)); await up(page, far);
    I = await info(page);
    t('pressing on neither character grabs nothing', I.trail.length === 1 && I.trailB.length === 1);
    await page.ctx.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed  (emulated WebKit, not a real iPad)');
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); try{ server.close(); }catch(_){} process.exit(2); });
