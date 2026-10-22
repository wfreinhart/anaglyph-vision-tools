// Real (hit-tested) mouse input: press on the visible mover, walk the solution.
const { webkit } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((q, r) => { fs.readFile(path.join(__dirname, q.url.split('?')[0]), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, {'content-type':'text/html'}); r.end(d); } }); }).listen(8766, async () => {
  const b = await webkit.launch(); let bad = 0;
  for (const n of [3, 6]) for (const touch of [false, true]) {
    const c = await b.newContext({ viewport:{width:1024,height:768}, hasTouch:touch });
    const p = await c.newPage();
    await p.goto('http://127.0.0.1:8766/puzzle.html');
    await p.evaluate(n => localStorage.setItem('anaglyph.puzzle.v1', JSON.stringify({mode:'maze', mazeN:n, mazeShow:true, mazeSlow:false})), n);
    await p.reload(); await p.waitForTimeout(400);
    const g = await p.evaluate(() => {
      const sol = [...document.querySelectorAll('svg.maze path')].find(e => /mzsol|way/.test(e.getAttribute('class') || ''));
      const pts = sol.getAttribute('d').match(/[ML][^ML]+/g).map(s => s.slice(1).trim().split(/[ ,]+/).map(Number));
      sol.remove(); const mv = document.querySelector('.mzmover').getBoundingClientRect();
      const mc = { x: mv.left + mv.width / 2, y: mv.top + mv.height / 2 };
      const top = document.elementFromPoint(mc.x, mc.y);
      return { pts, mc, top: top.tagName + '.' + (top.getAttribute('class') || ''), trail: () => 0 };
    });
    const dx = g.mc.x - g.pts[0][0], dy = g.mc.y - g.pts[0][1];
    await p.mouse.move(g.mc.x, g.mc.y); await p.mouse.down();
    for (const [x, y] of g.pts.slice(1)) await p.mouse.move(x + dx, y + dy, { steps: 6 });
    const trail = await p.evaluate(() => document.querySelector('svg.maze').dataset.trail.split(',').length);
    await p.mouse.up(); await p.waitForTimeout(300);
    const tally = await p.evaluate(() => document.body.innerText.match(/(\d+)\s*DONE/i)?.[1]);
    const ok = trail === g.pts.length;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} n=${n} touchCtx=${touch} hit=${g.top} trail ${trail}/${g.pts.length} tally=${tally}`);
    await c.close();
  }
  console.log(bad ? bad + ' failed' : 'all real-input drags reached the goal');
  await b.close(); srv.close();
});
