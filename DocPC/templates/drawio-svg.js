// Exports each drawio/<name>.drawio to figures/<name>.svg with the official draw.io viewer, in headless Microsoft Edge.
// So an edit made in draw.io (desktop or app.diagrams.net) reaches the report: edit the .drawio, run this, then assemble.
// Usage: node drawio-svg.js [name ...]   (no names = all files in drawio/)
// The diagram stays on this computer: the page only downloads the viewer script from viewer.diagrams.net.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const dir = path.join(__dirname, 'drawio'), tmp = path.join(__dirname, 'drawio', '_page.html');
const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter(f => f.endsWith('.drawio')).map(f => f.slice(0, -7));
for (const n of names) {
  const xml = fs.readFileSync(path.join(dir, `${n}.drawio`), 'utf8');
  const cfg = JSON.stringify({ xml, toolbar: '', 'auto-fit': false, resize: false, lightbox: false, nav: false }).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  // The viewer loads the diagram, then draw.io's own SVG export (graph.getSvg) goes into a <textarea>, so --dump-dom prints it as text.
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="dg" data-mxgraph='${cfg}'></div>
<textarea id="out"></textarea>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
<script>GraphViewer.createViewerForElement(document.getElementById('dg'), v => {
  document.getElementById('out').textContent = new XMLSerializer().serializeToString(v.graph.getSvg('#ffffff', 1, 10)); });</script></body></html>`);
  const dom = execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', 'file:///' + tmp.replace(/\\/g, '/')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const m = dom.match(/<textarea id="out">([\s\S]*?)<\/textarea>/);
  const svg = m && m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  if (!svg || !svg.startsWith('<svg')) { console.error(`${n}: no SVG from the viewer`); process.exitCode = 1; continue; }
  // Word does not read the CSS light-dark() colours of the dark-mode styles; the plain fill and stroke attributes stay.
  // A label in HTML form (foreignObject) is empty in Word: keep only its plain <text> copy.
  const out = svg.replace(/ style="[^"]*light-dark[^"]*"/g, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, '').replace(/<\/?switch>/g, '')
    .replace(/<a [^>]*svg-export-text-problems[\s\S]*?<\/a>/g, ''); // draw.io's 'Text is not SVG' notice
  fs.mkdirSync(path.join(__dirname, 'figures'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'figures', `${n}.svg`), out);
  console.log(`figures/${n}.svg from draw.io (${out.match(/width="([^"]+)"/)[1]} x ${out.match(/height="([^"]+)"/)[1]})`);
}
fs.rmSync(tmp, { force: true });
