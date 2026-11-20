// Checks that every line end in an exported draw.io SVG touches a shape border (no gap, no overshoot).
// For a line with an arrow head, the tip of the head is checked; for other lines (ERD), the line end.
// Usage: node touch.js figures/context.svg figures/dfd0.svg ...   Exit code = the number of bad ends.
const fs = require('fs');
const TOL = 0.75; // half the 1.3 px border, plus rounding in the export
const nums = d => [...d.matchAll(/([MLQZ])([^MLQZ]*)/g)].map(([, c, v]) => [c, v.trim().split(/[\s,]+/).filter(Boolean).map(Number)]);
// Outline of a shape as a list of points (curves and ellipses sampled).
function outline(tag, a) {
  if (tag === 'rect') { const x = +a.x, y = +a.y, w = +a.width, h = +a.height; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]; }
  if (tag === 'ellipse') return Array.from({ length: 721 }, (_, i) => [+a.cx + +a.rx * Math.cos(i * Math.PI / 360), +a.cy + +a.ry * Math.sin(i * Math.PI / 360)]);
  const pts = []; let cur, start;
  for (const [c, n] of nums(a.d)) {
    if (c === 'M') { cur = start = [n[0], n[1]]; pts.push(cur); }
    else if (c === 'L') { cur = [n[0], n[1]]; pts.push(cur); }
    else if (c === 'Q') { const p0 = cur; for (let t = 0.01; t <= 1.0001; t += 0.01) pts.push([(1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * n[0] + t * t * n[2], (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * n[1] + t * t * n[3]]); cur = [n[2], n[3]]; }
    else if (c === 'Z') pts.push(start);
  }
  return pts;
}
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
// draw.io pulls a filled arrow head back by 1.118 x its stroke width, so that the stroked tip ends on the point.
const HEAD = 1.118;
let bad = 0;
for (const file of process.argv.slice(2)) {
  const svg = fs.readFileSync(file, 'utf8'), shapes = [], edges = [];
  // Each draw.io cell is a <g data-cell-id> group; its first <g> holds the drawing (the label is in a later <g>).
  for (const [, body] of svg.matchAll(/<g data-cell-id="c\d+"><g transform="translate\(0\.5,0\.5\)">([\s\S]*?)<\/g>/g)) {
    const els = [...body.matchAll(/<(rect|ellipse|path)\b([^>]*)\/>/g)].map(([, t, r]) => [t, attrs(r)]);
    const i = els.findIndex(([t, a]) => t === 'path' && a.fill === 'none' && a['pointer-events'] === 'stroke');
    if (i >= 0) edges.push([outline('path', els[i][1]), els.filter((_, k) => k !== i)]);
    else for (const [t, a] of els) if (a.stroke && a.stroke !== 'none') shapes.push(outline(t, a));
  }
  const border = e => Math.min(...shapes.map(o => Math.min(...o.slice(1).map((q, i) => segDist(e, o[i], q)))));
  let worst = 0, n = 0;
  for (const [line, marks] of edges) for (const end of [line[0], line.at(-1)]) {
    // The end itself, or a point of the end mark (arrow head, crow's foot, bar, circle) near it, must be on a border.
    const cands = [[end, 0]];
    for (const [t, a] of marks) {
      const filled = a.fill && a.fill !== 'none';
      outline(t, a).filter(q => Math.hypot(q[0] - end[0], q[1] - end[1]) < 40).forEach((q, k) => cands.push([q, filled && k === 0 ? HEAD : 0]));
    }
    const d = Math.min(...cands.map(([q, allow]) => Math.abs(border(q) - allow)));
    n++; worst = Math.max(worst, d);
    if (d > TOL) { bad++; console.log(`${file}: line end at ${end.map(v => v.toFixed(1))} is ${d.toFixed(2)} px from the nearest border`); }
  }
  console.log(`${file}: ${n} line ends, ${shapes.length} shapes, largest gap ${worst.toFixed(2)} px`);
}
process.exitCode = bad;
