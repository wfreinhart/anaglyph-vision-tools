// Real (hit-tested) mouse input: press on either visible character and drag it along the route from its end
// on a smooth path (many small moves, wobbling up to 0.15 cell either side of the corridor centre line, not
// just cell centres), with the solution painted and without it. Whichever end walks, it meets the other
// character (half a cell short of it, along the corridors) and the other one never moves.
// Also in every experimental two-colour mode (chosen through the settings sheet, as a parent would): the
// drags work the same, and the way is painted only where it is offered (One colour, Trail in other colour).
const { webkit } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((q, r) => { fs.readFile(path.join(__dirname, q.url.split('?')[0]), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, {'content-type':'text/html'}); r.end(d); } }); }).listen(8766, async () => {
  const b = await webkit.launch(); let bad = 0;
  const runs = [];
  for (const n of [3, 6]) for (const touch of [false, true]) for (const show of [true, false]) for (const from of ['A', 'B']) runs.push({ mode:'one', n, touch, show, from });
  for (const mode of ['trail', 'split', 'chars']) for (const n of [3, 6]) for (const touch of [false, true]) for (const from of ['A', 'B']) runs.push({ mode, n, touch, show:true, from });
  for (const { mode, n, touch, show, from } of runs) {
    const c = await b.newContext({ viewport:{width:1024,height:768}, hasTouch:touch });
    const p = await c.newPage();
    await p.goto('http://127.0.0.1:8766/puzzle.html');
    await p.evaluate(([n, show]) => localStorage.setItem('anaglyph.puzzle.v1', JSON.stringify({mode:'maze', mazeN:n, mazeShow:show, mazeSlow:false})), [n, show]);
    await p.reload(); await p.waitForTimeout(400);
    if (mode !== 'one') {                                     // the parent's way in: gear, chip, Done
      await p.click('#gear'); await p.waitForTimeout(400);
      await p.click('#mazeColoursChips [data-colours="' + mode + '"]');
      await p.click('#done'); await p.waitForTimeout(400);
    }
    const inMode = await p.evaluate(() => document.querySelector('svg.maze').dataset.colours);
    const wayOffered = mode === 'one';
    const g = await p.evaluate(() => {
      const s = document.querySelector('svg.maze'), d = s.dataset, N = Number(d.n), cs = Number(d.cs);
      const open = d.open.split(',').map(Number), start = Number(d.start), goal = Number(d.goal);
      // the route, found here from the data attributes (not read off the painted solution)
      const prev = new Array(N * N).fill(-1), q = [start]; prev[start] = start;
      for (let k = 0; k < q.length; k++) {
        const at = q[k];
        [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(dd => {
          if (!(open[at] & dd[2])) return;
          const to = (Math.floor(at / N) + dd[1]) * N + (at % N) + dd[0];
          if (prev[to] < 0) { prev[to] = at; q.push(to); }
        });
      }
      const route = [goal]; while (route[0] !== start) route.unshift(prev[route[0]]);
      const r = s.getBoundingClientRect(), vb = s.viewBox.baseVal, left = r.left - vb.x, top = r.top - vb.y;
      const ctr = i => ({ x: left + (i % N + 0.5) * cs, y: top + (Math.floor(i / N) + 0.5) * cs });
      const pieces = document.querySelectorAll('.mzchar');
      const box = e => { const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; };
      return { route, pts: route.map(ctr), A: box(pieces[0]), B: box(pieces[1]), painted: !!document.querySelector('.mzsol'), cs };
    });
    const mc = from === 'A' ? g.A : g.B, pts = from === 'A' ? g.pts : g.pts.slice().reverse();
    const top = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e.tagName + '.' + (e.getAttribute('class') || ''); }, [mc.x, mc.y]);
    const dx = mc.x - pts[0].x, dy = mc.y - pts[0].y;       // the press lands on the character, off its cell centre
    await p.mouse.move(mc.x, mc.y); await p.mouse.down();
    let q = 0;
    for (let i = 1; i < pts.length; i++) {                   // smooth: eight small moves per cell, wobbling off the line
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y) || 1, px = -(b.y - a.y) / len, py = (b.x - a.x) / len;
      for (let k = 1; k <= 8; k++) {
        const w = k < 8 ? Math.sin(q++ * 0.9) * 0.15 * g.cs : 0;
        await p.mouse.move(a.x + (b.x - a.x) * k / 8 + px * w + dx, a.y + (b.y - a.y) * k / 8 + py * w + dy, { steps: 2 });
      }
    }
    const got = await p.evaluate(from => {
      const d = document.querySelector('svg.maze').dataset;
      return { mine: (from === 'A' ? d.trailA : d.trailB).split(',').length, other: (from === 'A' ? d.trailB : d.trailA).split(',').length };
    }, from);
    await p.mouse.up(); await p.waitForTimeout(300);
    const tally = await p.evaluate(() => document.querySelector('#hitCount').textContent);
    // it walked the route up to half a cell short of the other character (the meeting), the other never moved, and it counted
    const ok = got.mine === pts.length - 1 && got.other === 1 && tally === '1' && g.painted === (show && wayOffered) && inMode === mode && /^(svg|path)/.test(top);
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} mode=${mode} n=${n} touchCtx=${touch} way=${g.painted ? 'painted' : 'hidden'} from=${from} hit=${top} trail ${got.mine}/${pts.length - 1} other=${got.other} tally=${tally}`);
    await c.close();
  }
  console.log(bad ? bad + ' failed' : 'all real-input smooth drags from either end met the other character');
  await b.close(); srv.close();
});
