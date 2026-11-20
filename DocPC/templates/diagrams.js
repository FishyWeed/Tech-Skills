// Draws the generated figures as simple SVG files in gen/. Then `node svg2drawio.js gen/*.svg` makes an editable
// drawio/<name>.drawio once (an existing file is kept), and `node drawio-svg.js` exports figures/<name>.svg for the report.
// The Gantt chart reads plan.json. Add more diagram functions with the helpers box, line, plain and text.
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync(__dirname + '/plan.json', 'utf8'));

const INK = '#1a1a1a', QUIET = '#555555', EDGE = '#6b6b6b', ACCENT = '#6b6b6b', DONE = '#bdbdbd', GRID = '#dddddd', FONT = 'Arial';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${EDGE}"/></marker></defs>
<rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>`;
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 13}" font-weight="${o.bold ? 700 : 400}" fill="${o.fill || INK}" text-anchor="${o.anchor || 'middle'}">${esc(s)}</text>`;
// A box with one or more centred lines (split on \n).
const box = (cx, cy, w, h, label, o = {}) => {
  const lines = label.split('\n'), size = o.size || 13, lh = size + 3;
  const y0 = cy - ((lines.length - 1) * lh) / 2 + size / 3;
  return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="${EDGE}" stroke-width="1.2"/>` +
    lines.map((l, i) => text(cx, y0 + i * lh, l, { size, bold: o.bold && i === 0 })).join('');
};
const line = d => `<path d="${d}" fill="none" stroke="${EDGE}" stroke-width="1.3" marker-end="url(#a)"/>`;
const plain = d => `<path d="${d}" fill="none" stroke="${EDGE}" stroke-width="1.3"/>`;

// Gantt chart from plan.json: one row for each task, a dark bar for each group row. The weeks fit the plan dates.
function gantt() {
  const day = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
  const rows = plan.map(r => {
    if (!r.group) return r;
    const kids = plan.filter(k => !k.group && k.id.startsWith(r.id.replace(/\.0$/, '.')));
    return { ...r, s: kids.map(k => k.s).sort()[0], e: kids.map(k => k.e).sort().at(-1) };
  });
  const first = Math.min(...rows.map(r => day(r.s))), last = Math.max(...rows.map(r => day(r.e)));
  const t0 = first - ((new Date(first * 864e5).getUTCDay() + 6) % 7); // the Monday of the first week
  const weeks = Math.ceil((last - t0 + 1) / 7), x0 = 250, span = 490, px = span / (weeks * 7), rowH = 24, y0 = 74;
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const out = [text(24, 50, 'Activity', { anchor: 'start', bold: true, size: 12 })];
  const every = Math.ceil(weeks / 12); // at most 12 date labels
  for (let k = 0; k <= weeks; k++) {
    const x = x0 + k * 7 * px, dt = new Date((t0 + k * 7) * 864e5);
    out.push(`<line x1="${x}" x2="${x}" y1="${y0 - 14}" y2="${y0 + rows.length * rowH}" stroke="${GRID}"/>`);
    if (k < weeks && k % every === 0) out.push(text(x + 3.5 * px, 50, `${dt.getUTCDate()} ${mon[dt.getUTCMonth()]}`, { size: 10, fill: QUIET }));
  }
  rows.forEach((r, i) => {
    const y = y0 + i * rowH, xs = x0 + (day(r.s) - t0) * px, xe = x0 + (day(r.e) - t0 + 1) * px;
    if (i % 2 === 0) out.push(`<rect x="20" y="${y - 2}" width="${x0 + span - 20}" height="${rowH}" fill="#f5f5f5" opacity="0.8"/>`);
    out.push(text(r.group ? 24 : 34, y + 14, r.group ? r.name : (r.g || r.name), { anchor: 'start', size: 11.5, bold: r.group }));
    out.push(`<rect x="${xs}" y="${y + 4}" width="${Math.max(xe - xs, 3)}" height="${r.group ? 10 : 13}" rx="3" fill="${r.group ? '#2b2b2b' : (r.status === 'Done' ? DONE : ACCENT)}"/>`);
  });
  const yl = y0 + rows.length * rowH + 22;
  out.push(`<rect x="250" y="${yl - 9}" width="18" height="10" rx="2" fill="${DONE}"/>`, text(274, yl, 'Done', { anchor: 'start', size: 11, fill: QUIET }),
    `<rect x="320" y="${yl - 9}" width="18" height="10" rx="2" fill="${ACCENT}"/>`, text(344, yl, 'Planned or in progress', { anchor: 'start', size: 11, fill: QUIET }),
    `<rect x="490" y="${yl - 7}" width="18" height="6" rx="2" fill="#2b2b2b"/>`, text(514, yl, 'Phase total', { anchor: 'start', size: 11, fill: QUIET }));
  return svg(760, yl + 14, out.join(''));
}

// Hierarchy chart: a root box, its modules and the functions of each module. Change the spec for the document.
const HIERARCHY = ['System Name', [
  ['Module 1', ['Function A', 'Function B']],
  ['Module 2', ['Function C', 'Function D', 'Function E']],
  ['Module 3', ['Function F']],
]];
function hierarchy() {
  const [root, mods] = HIERARCHY, W = 760, cw = Math.min(150, (W - 12) / mods.length - 6), gap = 6;
  const x0 = (W - (mods.length * cw + (mods.length - 1) * gap)) / 2 + cw / 2, rootY = 40, modY = 140, out = [];
  const most = Math.max(...mods.map(m => m[1].length));
  out.push(box(W / 2, rootY, 400, 50, root, { bold: true, size: 14 }));
  out.push(plain(`M${W / 2} ${rootY + 25}V${rootY + 50}`), plain(`M${x0} ${rootY + 50}H${x0 + (mods.length - 1) * (cw + gap)}`));
  mods.forEach(([m, kids], i) => {
    const cx = x0 + i * (cw + gap);
    out.push(line(`M${cx} ${rootY + 50}V${modY - 24}`), box(cx, modY, cw, 48, m, { bold: true, size: 12 }));
    if (!kids.length) return;
    out.push(plain(`M${cx - cw / 2 + 10} ${modY + 24}V${modY + 78 + (kids.length - 1) * 56}`));
    kids.forEach((k, j) => {
      const ky = modY + 78 + j * 56;
      out.push(line(`M${cx - cw / 2 + 10} ${ky}H${cx - cw / 2 + 18}`), box(cx + 9, ky, cw - 18, 44, k, { size: 11 }));
    });
  });
  return svg(W, modY + 78 + most * 56, out.join(''));
}

fs.mkdirSync(__dirname + '/gen', { recursive: true });
for (const [n, f] of Object.entries({ gantt, hierarchy })) fs.writeFileSync(`${__dirname}/gen/${n}.svg`, f());
console.log('gen/*.svg written');
