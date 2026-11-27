// Turns a simple SVG drawing (rect, text, line, circle, polygon, path) into an editable draw.io file.
// The charts and wireframes pipelines draw SVGs into gen/; this turns each one into drawio/<name>.drawio once, so the
// user can edit it in draw.io. Each SVG element becomes one draw.io shape, text label or line, in the same order.
// Usage by hand: node svg2drawio.js gen/<name>.svg ... [--reset]   (in Source/; an existing file is kept unless --reset)
// CAUTION: --reset overwrites draw.io edits.
const fs = require('fs'), path = require('path');
const { src } = require('./paths.js');
const { escapeAttr, unescapeXml, parseAttrs } = require('./xml.js');
const n1 = v => +(+v).toFixed(1);

const filled = a => a.fill && a.fill !== 'none';
const paint = a => `fillColor=${filled(a) ? a.fill : 'none'};strokeColor=${a.stroke || 'none'};strokeWidth=${a['stroke-width'] || 1};${a.opacity ? `opacity=${a.opacity * 100};` : ''}`;
const lineStyle = a => `strokeColor=${a.stroke || '#333333'};strokeWidth=${a['stroke-width'] || 1};endArrow=${a['marker-end'] ? 'block' : 'none'};${a['stroke-dasharray'] ? `dashed=1;dashPattern=${a['stroke-dasharray']};` : ''}`;

// The points of a path made of M, L, H, V and their relative forms.
function pathPoints(d) {
  const pts = [];
  let x = 0, y = 0;
  for (const [, c, v] of d.matchAll(/([MLHVZmlhvz])([^MLHVZmlhvz]*)/g)) {
    const n = v.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (c === 'M' || c === 'L') [x, y] = n; else if (c === 'm' || c === 'l') { x += n[0]; y += n[1]; }
    else if (c === 'H') x = n[0]; else if (c === 'h') x += n[0]; else if (c === 'V') y = n[0]; else if (c === 'v') y += n[0]; else continue;
    pts.push([x, y]);
  }
  return pts;
}

// A label box around the SVG baseline: the text centre is about a third of the font size above the baseline.
// Returns the arguments of a vertex: x, y, width, height, text, style.
function textCell(a, body) {
  const size = +(a['font-size'] || 12), s = unescapeXml(body), w = s.length * size * 0.62 + 4, h = size * 1.4, cy = +a.y - size / 3;
  const al = { start: 'left', middle: 'center', end: 'right' }[a['text-anchor'] || 'start'];
  const x = al === 'left' ? +a.x : al === 'center' ? +a.x - w / 2 : +a.x - w;
  return [x, cy - h / 2, w, h, s, `text;align=${al};verticalAlign=middle;spacing=0;spacingLeft=0;spacingRight=0;spacingTop=0;spacingBottom=0;fontSize=${size};fontColor=${a.fill || '#1a1a1a'};fontStyle=${a['font-weight'] === '700' ? 1 : 0};fillColor=none;strokeColor=none;`];
}

function convert(svg) {
  const cells = [];
  let id = 2;
  const vtx = (x, y, w, h, value, style) => cells.push(`<mxCell id="c${id++}" value="${escapeAttr(value)}" style="html=0;fontFamily=Arial;${style}" vertex="1" parent="1"><mxGeometry x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" as="geometry"/></mxCell>`);
  const edg = (pts, style) => {
    const [s, ...rest] = pts, t = rest.pop();
    const mid = rest.map(p => `<mxPoint x="${n1(p[0])}" y="${n1(p[1])}"/>`).join('');
    cells.push(`<mxCell id="c${id++}" value="" style="html=0;rounded=0;endFill=1;endSize=6;${style}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${n1(s[0])}" y="${n1(s[1])}" as="sourcePoint"/><mxPoint x="${n1(t[0])}" y="${n1(t[1])}" as="targetPoint"/>${mid ? `<Array as="points">${mid}</Array>` : ''}</mxGeometry></mxCell>`);
  };
  // shortcut: every filled shape in these figures is a diamond, so it becomes a rhombus over its bounding box.
  const diamond = (a, pts) => {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    vtx(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), '', `rhombus;${paint(a)}`);
  };
  const draw = {
    // A rect without x is the white page background; the draw.io export adds its own.
    rect: a => a.x !== undefined && vtx(+a.x, +a.y, +a.width, +a.height, '', `${+a.rx ? `rounded=1;absoluteArcSize=1;arcSize=${2 * a.rx};` : 'rounded=0;'}${paint(a)}`),
    text: (a, body) => vtx(...textCell(a, body)),
    line: a => edg([[+a.x1, +a.y1], [+a.x2, +a.y2]], lineStyle(a)),
    circle: a => vtx(a.cx - a.r, a.cy - a.r, 2 * a.r, 2 * a.r, '', `ellipse;${paint(a)}`),
    polygon: a => diamond(a, a.points.trim().split(/\s+/).map(p => p.split(',').map(Number))),
    path: a => (filled(a) ? diamond(a, pathPoints(a.d)) : edg(pathPoints(a.d), lineStyle(a))),
  };
  const shapes = svg.replace(/<defs>[\s\S]*?<\/defs>/g, ''); // arrow markers are not shapes
  for (const [, tag, raw, body] of shapes.matchAll(/<(rect|text|line|circle|polygon|path)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) draw[tag](parseAttrs(raw), body);
  return cells;
}

// Writes drawio/<name>.drawio from the SVG text. Returns false (and writes nothing) if the file exists and reset is off.
function toDrawio(name, svg, reset = false) {
  const file = src('drawio', `${name}.drawio`);
  if (fs.existsSync(file) && !reset) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `<mxfile host="svg2drawio.js"><diagram name="${name}"><mxGraphModel grid="0" page="0" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${convert(svg).join('')}</root></mxGraphModel></diagram></mxfile>`);
  return true;
}

// Converts gen/<name>.svg for each name and prints what it did.
function fromGen(names, reset = false) {
  for (const name of names) {
    const made = toDrawio(name, fs.readFileSync(src('gen', `${name}.svg`), 'utf8'), reset);
    console.log(`${made ? 'created' : 'kept'} drawio/${name}.drawio`);
  }
}

module.exports = { toDrawio, fromGen };

if (require.main === module) {
  const files = process.argv.slice(2).filter(a => a !== '--reset');
  fromGen(files.map(f => path.basename(f, '.svg')), process.argv.includes('--reset'));
}
