// XML text helpers for the draw.io files, the exported SVGs and the test reports.
// escapeAttr keeps a line break as &#xa;, so that a draw.io label keeps its lines.
const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');
const unescapeXml = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const parseAttrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

module.exports = { escapeAttr, unescapeXml, parseAttrs };
