// Exports drawio/<name>.drawio to figures/<name>.svg with the official draw.io viewer, in headless Microsoft Edge.
// So an edit made in draw.io (desktop or app.diagrams.net) reaches the report: edit the .drawio, then run its pipeline again.
// Usage by hand: node drawio-export.js [name ...]   (in Source/; no names = all files in drawio/)
// The diagram stays on this computer: the page only downloads the viewer script from viewer.diagrams.net.
const fs = require('fs'), { execFileSync } = require('child_process');
const { src } = require('./paths.js');
const { unescapeXml } = require('./xml.js');

const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// The viewer loads the diagram, then draw.io's own SVG export (graph.getSvg) goes into a <textarea>, so --dump-dom
// prints it as text.
function viewerPage(xml) {
  const cfg = JSON.stringify({ xml, toolbar: '', 'auto-fit': false, resize: false, lightbox: false, nav: false }).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="dg" data-mxgraph='${cfg}'></div>
<textarea id="out"></textarea>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
<script>GraphViewer.createViewerForElement(document.getElementById('dg'), v => {
  document.getElementById('out').textContent = new XMLSerializer().serializeToString(v.graph.getSvg('#ffffff', 1, 10)); });</script></body></html>`;
}

// Word does not read the CSS light-dark() colours of the dark-mode styles; the plain fill and stroke attributes stay.
// A label in HTML form (foreignObject) is empty in Word: keep only its plain <text> copy.
const forWord = svg => svg.replace(/ style="[^"]*light-dark[^"]*"/g, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, '')
  .replace(/<\/?switch>/g, '').replace(/<a [^>]*svg-export-text-problems[\s\S]*?<\/a>/g, ''); // draw.io's 'Text is not SVG' notice

// Exports each name and returns the number of diagrams that failed.
function exportDrawio(names) {
  const tmp = src('drawio', '_page.html');
  let failed = 0;
  fs.mkdirSync(src('figures'), { recursive: true });
  for (const name of names) {
    fs.writeFileSync(tmp, viewerPage(fs.readFileSync(src('drawio', `${name}.drawio`), 'utf8')));
    const dom = execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', 'file:///' + tmp.replace(/\\/g, '/')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = dom.match(/<textarea id="out">([\s\S]*?)<\/textarea>/), svg = m && unescapeXml(m[1]);
    if (!svg || !svg.startsWith('<svg')) { console.error(`${name}: no SVG from the viewer (check the internet connection)`); failed++; continue; }
    const out = forWord(svg);
    fs.writeFileSync(src('figures', `${name}.svg`), out);
    console.log(`figures/${name}.svg from draw.io (${out.match(/width="([^"]+)"/)[1]} x ${out.match(/height="([^"]+)"/)[1]})`);
  }
  fs.rmSync(tmp, { force: true });
  return failed;
}

// Exports the diagrams and stops the pipeline if one failed. what names them in the error ("charts").
function exportOrStop(names, what) {
  if (exportDrawio(names)) throw new Error(`the export failed for some ${what}`);
}

module.exports = { exportDrawio, exportOrStop };

if (require.main === module) {
  const names = process.argv.slice(2).length ? process.argv.slice(2)
    : fs.readdirSync(src('drawio')).filter(f => f.endsWith('.drawio')).map(f => f.slice(0, -7));
  process.exitCode = exportDrawio(names);
}
