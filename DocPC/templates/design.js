// Draws the design diagrams from design.json straight into editable draw.io files: context diagram, DFDs and ERD.
// Each shape is a native draw.io shape (process circle, entity box, data store, ERD table) and each line is attached
// to its shapes, so the diagram stays easy to edit in draw.io. Every arrow head ends exactly on the border of its shape.
// Usage: node design.js [name ...] [--reset]   (no names = every diagram in design.json)
// A .drawio file is created only if it does not exist: once it exists, it is the source and the user may edit it.
// CAUTION: --reset overwrites draw.io edits. Then run `node drawio-svg.js` to export figures/<name>.svg.
//
// design.json holds one entry for each diagram. "type" is "context", "dfd" or "erd":
//   context: { system, entities: [name], flows }                  the system is the process "0"
//   dfd:     { left: [entity], processes: [[id, name]], stores: [name], right: [entity], flows }
//            an entity or store is "NAME" or ["NAME", y]; a process may have a y as its 3rd item
//   flows:   [from, to, label] for one flow, or [a, b, labelAtoB, labelBtoA] for two flows side by side;
//            a single flow may give the label position (0 to 1 along the line) as its 5th item: [a, b, label, null, 0.3]
//   erd:     Crow's Foot notation. { entities: [[name, column, row, [attribute]]], relations: [[entityA, verb, entityB, cardA, cardB]] }
//            an attribute is "name", "PK name", "FK name" or "PK,FK name" (a type may follow: "usr_email VARCHAR(100)")
//            a cardinality is "1", "0..1", "1..*" or "0..*" (the mark at that entity's end of the line)
const fs = require('fs'), path = require('path');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'design.json'), 'utf8'));

let CELLS = [], NEXT = 2, SHAPES = [], LINES = [];
const xa = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');
const r1 = v => +v.toFixed(1);
const BASE = 'html=0;fontFamily=Arial;fontColor=#1a1a1a;strokeColor=#333333;fillColor=#ffffff;';
const LABEL = 'labelBackgroundColor=#ffffff;fontSize=10.5;';
function vtx(x, y, w, h, value, style, parent = '1') {
  const id = 'c' + NEXT++;
  CELLS.push([1, `<mxCell id="${id}" value="${xa(value)}" style="${BASE}${style}" vertex="1" parent="${parent}"><mxGeometry x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" as="geometry"/></mxCell>`]);
  return id;
}
// A line under the shapes (drawn first). `at` is the label position from -1 (source end) to 1 (target end).
function edg(src, tgt, o = {}) {
  const pts = o.pts ? `<mxPoint x="${r1(o.pts[0][0])}" y="${r1(o.pts[0][1])}" as="sourcePoint"/><mxPoint x="${r1(o.pts[1][0])}" y="${r1(o.pts[1][1])}" as="targetPoint"/>` : '';
  CELLS.push([0, `<mxCell id="c${NEXT++}" value="${xa(o.label || '')}" style="${BASE}${LABEL}${o.arrows || 'endArrow=block;endFill=1;endSize=6;'}rounded=0;${o.style || ''}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry x="${o.at ?? 0}" relative="1" as="geometry">${pts}</mxGeometry></mxCell>`]);
}
const drawio = name => `<mxfile host="design.js"><diagram name="${name}"><mxGraphModel grid="0" page="0" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${CELLS.sort((a, b) => a[0] - b[0]).map(c => c[1]).join('')}</root></mxGraphModel></diagram></mxfile>`;

// Shapes. Each returns { name, cx, cy, box, id, inside(x, y) }; add() keeps it for the crossing check.
const add = sh => (SHAPES.push(sh), sh);
function proc(cx, cy, r, id, name) {
  const box = [cx - r, cy - r, 2 * r, 2 * r];
  return add({ name: id, cx, cy, box, id: vtx(...box, `${id}\n${name}`, 'ellipse;fontSize=11.5;strokeWidth=1.3;'), inside: (x, y) => Math.hypot(x - cx, y - cy) <= r });
}
function entity(cx, cy, name, w = 140, h = 46) {
  const box = [cx - w / 2, cy - h / 2, w, h];
  return add({ name, cx, cy, box, id: vtx(...box, name, 'rounded=0;strokeWidth=1.3;fontSize=12;'), inside: (x, y) => Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2 });
}
// Data store in the stored-data shape. Its outline is the one draw.io draws for dataStorage
// with size sz: the left side bulges out to x = 0, the right side curves in to x = w - sz (both quadratic curves).
function store(cx, cy, name, w = 150, h = 38, sz = 10) {
  const box = [cx - w / 2, cy - h / 2, w, h];
  return add({ name, cx, cy, box, id: vtx(...box, name, `shape=dataStorage;fixedSize=1;size=${sz};fontSize=11.5;strokeWidth=1.3;`),
    inside(x, y) {
      const lx = x - box[0], v = (y - box[1]) / h;
      return v >= 0 && v <= 1 && lx >= sz * (2 * v - 1) ** 2 && lx <= w - 4 * sz * v * (1 - v);
    } });
}
// The point where the line from (ox, oy) (inside the shape) toward (px, py) leaves the shape, found by halving.
function edgePoint(sh, ox, oy, px, py) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (sh.inside(ox + (px - ox) * m, oy + (py - oy) * m)) lo = m; else hi = m; }
  const d = Math.hypot(px - ox, py - oy), P = [ox + (px - ox) * lo, oy + (py - oy) * lo];
  if (sh.inside(P[0] + (px - ox) / d * 0.05, P[1] + (py - oy) / d * 0.05)) throw new Error('line end is not on the shape border'); // self-check
  return P;
}
// Exact attachment point of a line on a shape, so draw.io puts the line end where it is computed here.
const pin = (sh, p, k) => `${k}X=${((p[0] - sh.box[0]) / sh.box[2]).toFixed(5)};${k}Y=${((p[1] - sh.box[1]) / sh.box[3]).toFixed(5)};${k}Perimeter=0;`;
// A straight flow from a to b, shifted sideways by `off`, with its label at t (0 = at a, 1 = at b).
// The ends are where the shifted line itself crosses each border, so the arrow head touches the shape.
function flow(a, b, label, t = 0.5, off = 0) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy), nx = -dy / d * off, ny = dx / d * off;
  const A = [a.cx + nx, a.cy + ny], B = [b.cx + nx, b.cy + ny];
  if (!a.inside(...A) || !b.inside(...B) || a.inside(...B) || b.inside(...A)) throw new Error(`flow "${label}": the two shapes overlap or are too small`);
  const P = edgePoint(a, ...A, ...B), Q = edgePoint(b, ...B, ...A);
  LINES.push([label, a, b, A, B]);
  edg(a.id, b.id, { label, at: 2 * t - 1, style: pin(a, P, 'exit') + pin(b, Q, 'entry') });
}
function flows(N, list) {
  for (const [a, b, t1, t2, t] of list) {
    if (!N[a] || !N[b]) throw new Error(`flow ${a} -> ${b}: no shape named "${N[a] ? b : a}"`);
    if (t2) { flow(N[a], N[b], t1, 0.25, -9); flow(N[b], N[a], t2, 0.25, -9); } else flow(N[a], N[b], t1, t ?? 0.5);
  }
}
const item = v => (Array.isArray(v) ? v : [v]);
// A column of entities or stores. An item without its own y sits at the mean y of the processes it links to,
// then the column is pushed apart so that no two items overlap.
function column(list, ps, links, gap) {
  const py = Object.fromEntries(ps.map(p => [p[0], p[2]])), mid = ps.reduce((t, p) => t + p[2], 0) / ps.length;
  const out = list.map(v => { const [n, y] = item(v), ys = links.filter(([a, b]) => a === n || b === n).map(([a, b]) => py[a === n ? b : a]).filter(v => v !== undefined); return [n, y, y ?? (ys.length ? ys.reduce((t, v) => t + v, 0) / ys.length : mid)]; });
  out.sort((a, b) => a[2] - b[2]).forEach((o, i) => { if (i && o[1] === undefined) o[2] = Math.max(o[2], out[i - 1][2] + gap); });
  return out.map(([n, , y]) => [n, y]);
}

// Context diagram: the system as process 0 in the middle, the entities on an ellipse around it.
function context(s) {
  const n = s.entities.length, N = { 0: proc(450, 330, 115, '0', s.system) };
  s.entities.forEach((e, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2 + Math.PI / n;
    N[e] = entity(450 + 430 * Math.cos(a), 330 + 300 * Math.sin(a), e, 150);
  });
  flows(N, s.flows);
}
// DFD of any level: entities left (and right), processes in the middle, data stores on the right.
function dfd(s) {
  const N = {}, ps = s.processes.map(([id, nm, y], i) => [id, nm, y ?? 90 + i * 150]);
  ps.forEach(([id, nm, y]) => { N[id] = proc(420, y, 56, id, nm); });
  column(s.left || [], ps, s.flows, 80).forEach(([n, y]) => { N[n] = entity(110, y, n); });
  column(s.stores || [], ps, s.flows, 70).forEach(([n, y]) => { N[n] = store(720, y, n); });
  column(s.right || [], ps, s.flows, 80).forEach(([n, y]) => { N[n] = entity(1000, y, n); });
  flows(N, s.flows);
}
// ERD in Crow's Foot notation: each entity is a table (name on top, one row for each attribute with PK or FK),
// each relationship is a line with the cardinality marks at both ends and its verb in the middle.
// The lines are straight between the table centres; draw.io ends them on the table borders.
const MARK = { '1': 'ERmandOne', '0..1': 'ERzeroToOne', '1..*': 'ERoneToMany', '0..*': 'ERzeroToMany' };
function erd(s) {
  const E = {}, rowH = 22, head = 28, colW = [], rowTall = [];
  const ents = s.entities.map(([n, c, r, attrs]) => {
    const rows = attrs.map(a => { const m = a.match(/^((?:PK|FK)(?:\s*,\s*(?:PK|FK))?)\s+(.+)$/); return m ? [m[1].replace(/\s/g, ''), m[2]] : ['', a]; });
    const w = Math.max(170, n.length * 8.5 + 30, ...rows.map(([, t]) => t.length * 6.6 + 64));
    return { n, c, r, rows, w, h: head + rows.length * rowH };
  });
  // Each grid column is as wide as its widest table and each grid row as tall as its tallest table, plus room for the lines.
  ents.forEach(e => { colW[e.c] = Math.max(colW[e.c] || 0, e.w); rowTall[e.r] = Math.max(rowTall[e.r] || 0, e.h); });
  const sum = (list, i, gap) => list.slice(0, i).reduce((t, v) => t + (v || 0) + gap, 0);
  for (const e of ents) {
    if (E[e.n]) throw new Error(`erd: two entities named ${e.n}`);
    const x = sum(colW, e.c, 150) + (colW[e.c] - e.w) / 2, y = sum(rowTall, e.r, 120) + (rowTall[e.r] - e.h) / 2; // centred in the row, so lines in a row stay straight
    e.id = vtx(x, y, e.w, e.h, e.n, `swimlane;startSize=${head};fontStyle=1;fontSize=12.5;strokeWidth=1.3;collapsible=0;`);
    e.rows.forEach(([k, t], i) => {
      vtx(0, head + i * rowH, 44, rowH, k, 'text;fillColor=none;strokeColor=none;fontSize=10.5;fontStyle=1;align=center;verticalAlign=middle;', e.id);
      vtx(44, head + i * rowH, e.w - 44, rowH, t, `text;fillColor=none;strokeColor=none;fontSize=10.5;align=left;verticalAlign=middle;spacingLeft=4;${k.includes('PK') ? 'fontStyle=4;' : ''}`, e.id);
    });
    Object.assign(e, { name: e.n, cx: x + e.w / 2, cy: y + e.h / 2, inside: (px, py) => px >= x && px <= x + e.w && py >= y && py <= y + e.h });
    E[e.n] = add(e);
  }
  for (const [a, verb, b, ca, cb] of s.relations) {
    if (!E[a] || !E[b]) throw new Error(`relation ${a} - ${b}: no entity named "${E[a] ? b : a}"`);
    if (!MARK[ca] || !MARK[cb]) throw new Error(`relation ${a} - ${b}: a cardinality must be 1, 0..1, 1..* or 0..*`);
    edg(E[a].id, E[b].id, { label: verb, arrows: `startArrow=${MARK[ca]};endArrow=${MARK[cb]};startFill=0;endFill=0;startSize=14;endSize=14;` });
    LINES.push([verb, E[a], E[b], [E[a].cx, E[a].cy], [E[b].cx, E[b].cy]]);
  }
}

const draw = { context, dfd, erd };
const reset = process.argv.includes('--reset'), only = process.argv.slice(2).filter(a => a !== '--reset');
fs.mkdirSync(path.join(__dirname, 'drawio'), { recursive: true });
for (const [name, s] of Object.entries(spec)) {
  if (name.startsWith('_') || (only.length && !only.includes(name))) continue;
  const file = path.join(__dirname, 'drawio', `${name}.drawio`);
  if (fs.existsSync(file) && !reset) { console.log(`kept drawio/${name}.drawio`); continue; }
  if (!draw[s.type]) throw new Error(`${name}: type must be context, dfd or erd`);
  CELLS = []; NEXT = 2; SHAPES = []; LINES = []; draw[s.type](s);
  // Warn when a line runs through a shape that is not one of its ends: the layout needs a y value or another grid place.
  for (const [label, a, b, A, B] of LINES) {
    const n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 2), on = sh => Array.from({ length: n + 1 }, (_, i) => i / n).some(t => sh.inside(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t));
    for (const sh of SHAPES.filter(sh => sh !== a && sh !== b && on(sh)))
      console.log(`WARNING ${name}: the line "${String(label).replace(/\n/g, ' ')}" (${a.name} - ${b.name}) runs through ${sh.name}. Move a shape (y, column or row).`);
  }
  fs.writeFileSync(file, drawio(name)); console.log(`created drawio/${name}.drawio`);
}
