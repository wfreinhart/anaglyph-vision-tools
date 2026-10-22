// Real (hit-tested) mouse input: press on either visible character and walk the route from its end,
// with the solution painted and without it. Whichever end walks, it joins the other character.
const { webkit } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((q, r) => { fs.readFile(path.join(__dirname, q.url.split('?')[0]), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, {'content-type':'text/html'}); r.end(d); } }); }).listen(8766, async () => {
  const b = await webkit.launch(); let bad = 0;
  for (const n of [3, 6]) for (const touch of [false, true]) for (const show of [true, false]) for (const from of ['A', 'B']) {
    const c = await b.newContext({ viewport:{width:1024,height:768}, hasTouch:touch });
    const p = await c.newPage();
    await p.goto('http://127.0.0.1:8766/puzzle.html');
    await p.evaluate(([n, show]) => localStorage.setItem('anaglyph.puzzle.v1', JSON.stringify({mode:'maze', mazeN:n, mazeShow:show, mazeSlow:false})), [n, show]);
    await p.reload(); await p.waitForTimeout(400);
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
    for (const pt of pts.slice(1)) await p.mouse.move(pt.x + dx, pt.y + dy, { steps: 6 });
    const got = await p.evaluate(from => {
      const d = document.querySelector('svg.maze').dataset;
      return { mine: (from === 'A' ? d.trailA : d.trailB).split(',').length, other: (from === 'A' ? d.trailB : d.trailA).split(',').length };
    }, from);
    await p.mouse.up(); await p.waitForTimeout(300);
    const tally = await p.evaluate(() => document.querySelector('#hitCount').textContent);
    // it walked the whole route (the join step included), the other character never moved, and it counted
    const ok = got.mine === pts.length && got.other === 1 && tally === '1' && g.painted === show && /^(svg|path)/.test(top);
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} n=${n} touchCtx=${touch} way=${show ? 'painted' : 'hidden'} from=${from} hit=${top} trail ${got.mine}/${pts.length} other=${got.other} tally=${tally}`);
    await c.close();
  }
  console.log(bad ? bad + ' failed' : 'all real-input drags from either end joined the trails');
  await b.close(); srv.close();
});
