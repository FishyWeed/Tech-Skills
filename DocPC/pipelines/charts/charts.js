// Draws the charts of charts.json as simple SVG files in gen/. The charts pipeline then turns each one into an
// editable drawio/<name>.drawio (once; an existing file is kept) and exports figures/<name>.svg for the report.
// Usage by hand: node charts.js [name ...]   (in Source/)
//
// charts.json holds one entry for each chart. "type" is "gantt" or "hierarchy":
//   gantt:     {}                                        the project plan in plan.json, one row for each task
//   hierarchy: { root: name, modules: [[module, [function]]] }   a root box, its modules and their functions
// To add a chart type, add a function that returns SVG (helpers in lib/svg.js) and put it in TYPES.
const fs = require('fs');
const { QUIET, svg, text, box, line, plain } = require('../../lib/svg.js');
const { src, readJson } = require('../../lib/paths.js');
const { MONTHS, readPlan } = require('../../lib/plan.js');

const ACCENT = '#6b6b6b', DONE = '#bdbdbd', GRID = '#dddddd';

// Gantt chart from plan.json: one row for each task, a dark bar for each group row. The weeks fit the plan dates.
function gantt() {
  const day = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
  const rows = readPlan();
  const first = Math.min(...rows.map(r => day(r.s))), last = Math.max(...rows.map(r => day(r.e)));
  const t0 = first - ((new Date(first * 864e5).getUTCDay() + 6) % 7); // the Monday of the first week
  const weeks = Math.ceil((last - t0 + 1) / 7), x0 = 250, span = 490, px = span / (weeks * 7), rowH = 24, y0 = 74;
  const out = [text(24, 50, 'Activity', { anchor: 'start', bold: true, size: 12 })];
  const every = Math.ceil(weeks / 12); // at most 12 date labels
  for (let k = 0; k <= weeks; k++) {
    const x = x0 + k * 7 * px, dt = new Date((t0 + k * 7) * 864e5);
    out.push(`<line x1="${x}" x2="${x}" y1="${y0 - 14}" y2="${y0 + rows.length * rowH}" stroke="${GRID}"/>`);
    if (k < weeks && k % every === 0) out.push(text(x + 3.5 * px, 50, `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`, { size: 10, fill: QUIET }));
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

// Hierarchy chart: a root box, its modules and the functions of each module.
function hierarchy({ root, modules: mods }) {
  const W = 760, cw = Math.min(150, (W - 12) / mods.length - 6), gap = 6;
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

const TYPES = { gantt, hierarchy };

// Writes gen/<name>.svg for each chart and returns the names.
function build(only = []) {
  const spec = readJson('charts.json'), names = [];
  fs.mkdirSync(src('gen'), { recursive: true });
  for (const [name, c] of Object.entries(spec)) {
    if (name.startsWith('_') || (only.length && !only.includes(name))) continue;
    if (!TYPES[c.type]) throw new Error(`${name}: type must be ${Object.keys(TYPES).join(' or ')}`);
    fs.writeFileSync(src('gen', `${name}.svg`), TYPES[c.type](c));
    console.log(`gen/${name}.svg written`);
    names.push(name);
  }
  return names;
}

module.exports = { build };
if (require.main === module) build(process.argv.slice(2));
