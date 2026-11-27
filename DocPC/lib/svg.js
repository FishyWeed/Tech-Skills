// Shared helpers that draw simple SVG for diagrams.js and wireframe.js. svg2drawio.js turns the result into draw.io.
// Use only rect, text, line, circle, polygon and path (M, L, H, V): svg2drawio.js converts these elements.
const INK = '#1a1a1a', QUIET = '#555555', EDGE = '#6b6b6b', FONT = 'Arial';
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

module.exports = { INK, QUIET, EDGE, FONT, esc, svg, text, box, line, plain };
