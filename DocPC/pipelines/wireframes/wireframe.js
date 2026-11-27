// Draws low-fidelity wireframes from wireframe.json as simple SVG in gen/: grey boxes and labels, one file per screen.
// The wireframes pipeline then turns each one into an editable drawio/<screen>.drawio (once; an existing file is
// kept) and exports figures/<screen>.svg for the report.
// Usage by hand: node wireframe.js [screen ...]   (in Source/; no names = every screen in wireframe.json)
//
// wireframe.json holds one entry for each screen: { "device": "desktop" or "mobile", "title": text, "rows": [row] }.
// A row is one element, or a list of elements side by side (equal widths). An element is "type: text" or
// "type: text | option":
//   header: System name | Home, About, Login   a bar with the name on the left and the links on the right
//   nav: Home, Products, Cart                   a row of links
//   heading: Welcome back                       large bold text
//   text: A sentence                            one line of normal text
//   lines: 3                                    grey placeholder lines for body text (the number of lines)
//   input: Email                                a label and an empty field
//   select: Category                            a label and a field with an arrow
//   checkbox: Remember me                       a small box and its label
//   button: Log in | primary                    a button; "primary" makes it dark
//   link: Forgot your password?                 underlined text
//   image: Product photo | 160                  a box with a cross; the option is its height (default 140)
//   table: ID, Name, Status | 3                 a header row and empty rows; the option is the number of rows (default 3)
//   list: Item A, Item B, Item C                a bulleted list
//   card: Title | 3                             a card with an image, a title and placeholder lines (default 2)
//   space: 20                                   empty space; the option is its height
//   footer: Text                                a bar at the bottom of the content
const fs = require('fs');
const { INK, QUIET, svg, text } = require('../../lib/svg.js');
const { src, readJson } = require('../../lib/paths.js');

const LINE = '#8c8c8c', FILL = '#e6e6e6', SOFT = '#f2f2f2', BAR = '#d9d9d9', GAP = 16;
const rect = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}" fill="${o.fill || '#ffffff'}" stroke="${o.stroke || LINE}" stroke-width="1"/>`;
const bar = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="8" rx="4" fill="${BAR}"/>`;
const seg = (x1, y1, x2, y2, c = LINE) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1"/>`;
const label = (x, y, s, o = {}) => text(x, y, s, { anchor: 'start', size: 12, ...o });
const items = s => s.split(',').map(t => t.trim()).filter(Boolean);
const cross = (x, y, w, h) => rect(x, y, w, h, { fill: SOFT }) + seg(x, y, x + w, y + h) + seg(x + w, y, x, y + h);
// Each element returns [svg, height] for the top-left corner (x, y) and the width w.
const EL = {
  header: (x, y, w, s, o) => {
    let out = rect(x, y, w, 48, { fill: FILL }) + label(x + 16, y + 30, s, { size: 15, bold: true }), rx = x + w - 16;
    for (const l of items(o || '').reverse()) { out += text(rx, y + 29, l, { anchor: 'end', size: 12 }); rx -= l.length * 7.5 + 24; }
    return [out, 48];
  },
  nav: (x, y, w, s) => {
    let out = seg(x, y + 32, x + w, y + 32), lx = x;
    for (const l of items(s)) { out += label(lx, y + 21, l); lx += l.length * 7.5 + 28; }
    return [out, 34];
  },
  heading: (x, y, w, s) => [label(x, y + 22, s, { size: 20, bold: true }), 30],
  text: (x, y, w, s) => [label(x, y + 14, s, { size: 13 }), 20],
  lines: (x, y, w, s) => { const n = +s || 3; return [Array.from({ length: n }, (_, i) => bar(x, y + 4 + i * 16, i === n - 1 && n > 1 ? w * 0.6 : w)).join(''), n * 16]; },
  input: (x, y, w, s) => [label(x, y + 12, s) + rect(x, y + 18, w, 32, { rx: 3 }), 50],
  select: (x, y, w, s) => [label(x, y + 12, s) + rect(x, y + 18, w, 32, { rx: 3 }) + text(x + w - 14, y + 39, '▾', { size: 14, fill: QUIET }), 50],
  checkbox: (x, y, w, s) => [rect(x, y + 3, 14, 14, { rx: 2 }) + label(x + 22, y + 15, s), 20],
  button: (x, y, w, s, o) => {
    const bw = Math.min(w, Math.max(120, s.length * 8 + 40)), dark = o === 'primary';
    return [rect(x, y, bw, 36, { rx: 6, fill: dark ? '#4d4d4d' : '#ffffff', stroke: dark ? '#4d4d4d' : LINE }) + text(x + bw / 2, y + 23, s, { size: 13, bold: true, fill: dark ? '#ffffff' : INK }), 36];
  },
  link: (x, y, w, s) => [label(x, y + 14, s, { fill: '#333333' }) + seg(x, y + 17, x + s.length * 5.8, y + 17, '#333333'), 20],
  image: (x, y, w, s, o) => {
    const h = +o || 140, lw = s.length * 7 + 16;
    return [cross(x, y, w, h) + rect(x + w / 2 - lw / 2, y + h / 2 - 11, lw, 22, { stroke: 'none' }) + text(x + w / 2, y + h / 2 + 4, s, { size: 12, fill: QUIET }), h];
  },
  table: (x, y, w, s, o) => {
    const cols = items(s), n = +o || 3, cw = w / cols.length;
    let out = '';
    for (let r = 0; r <= n; r++) cols.forEach((c, i) => {
      out += rect(x + i * cw, y + r * 28, cw, 28, { fill: r ? '#ffffff' : FILL });
      out += r ? bar(x + i * cw + 10, y + r * 28 + 10, cw * 0.55) : label(x + i * cw + 10, y + 18, c, { bold: true });
    });
    return [out, (n + 1) * 28];
  },
  list: (x, y, w, s) => [items(s).map((t, i) => `<circle cx="${x + 5}" cy="${y + 10 + i * 22}" r="3" fill="${QUIET}"/>` + label(x + 16, y + 14 + i * 22, t)).join(''), items(s).length * 22],
  card: (x, y, w, s, o) => {
    const n = +o || 2, h = 90 + 40 + n * 16;
    return [rect(x, y, w, h, { rx: 6 }) + cross(x + 10, y + 10, w - 20, 80) + label(x + 12, y + 114, s, { size: 13, bold: true }) +
      Array.from({ length: n }, (_, i) => bar(x + 12, y + 126 + i * 16, i === n - 1 && n > 1 ? (w - 24) * 0.6 : w - 24)).join(''), h];
  },
  space: (x, y, w, s) => ['', +s || 20],
  footer: (x, y, w, s) => [rect(x, y, w, 40, { fill: FILL }) + text(x + w / 2, y + 25, s, { size: 11, fill: QUIET }), 40],
};

function screen(name, s) {
  const mobile = s.device === 'mobile', W = mobile ? 380 : 1000, pad = mobile ? 18 : 28, top = mobile ? 74 : 60;
  const x0 = 10 + pad, cw = W - 20 - 2 * pad, out = [];
  let y = top;
  for (const row of s.rows) {
    const els = Array.isArray(row) ? row : [row], ew = (cw - (els.length - 1) * GAP) / els.length;
    let rowH = 0;
    els.forEach((e, i) => {
      const m = String(e).match(/^\s*(\w+)\s*:\s*([^|]*?)\s*(?:\|\s*(.*?)\s*)?$/);
      if (!m || !EL[m[1]]) throw new Error(`${name}: unknown element "${e}". Types: ${Object.keys(EL).join(', ')}`);
      const [part, h] = EL[m[1]](x0 + i * (ew + GAP), y, ew, m[2], m[3]);
      out.push(part); rowH = Math.max(rowH, h);
    });
    y += rowH + 14;
  }
  const H = y + pad - 14;
  // The frame: a browser window for desktop, a phone for mobile. The title of the screen is in its top bar.
  const frame = mobile
    ? rect(10, 10, W - 20, H, { rx: 24 }) + seg(10, 40, W - 10, 40) + text(W / 2, 30, s.title || name, { size: 12, bold: true })
    : rect(10, 10, W - 20, H, { rx: 6 }) + rect(10, 10, W - 20, 30, { rx: 6, fill: SOFT }) +
      [0, 1, 2].map(i => `<circle cx="${28 + i * 16}" cy="25" r="5" fill="#ffffff" stroke="${LINE}" stroke-width="1"/>`).join('') +
      rect(90, 17, W - 200, 16, { rx: 8 }) + text(W / 2, 29, s.title || name, { size: 11, fill: QUIET });
  return svg(W, H + 20, frame + out.join(''));
}

// Writes gen/<screen>.svg for each screen and returns the names.
function build(only = []) {
  const spec = readJson('wireframe.json'), names = [];
  fs.mkdirSync(src('gen'), { recursive: true });
  for (const [name, s] of Object.entries(spec)) {
    if (name.startsWith('_') || (only.length && !only.includes(name))) continue;
    fs.writeFileSync(src('gen', `${name}.svg`), screen(name, s));
    console.log(`gen/${name}.svg written`);
    names.push(name);
  }
  return names;
}

module.exports = { build };
if (require.main === module) build(process.argv.slice(2));
