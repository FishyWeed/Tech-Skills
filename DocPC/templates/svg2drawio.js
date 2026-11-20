// Turns a simple SVG drawing (rect, text, line, circle, polygon, path) into an editable draw.io file.
// diagrams.js draws SVGs into gen/; this script turns each one into drawio/<name>.drawio once, so the user can edit it in draw.io.
// Each SVG element becomes one draw.io shape, text label or line, in the same order, so the drawing order stays the same.
// Usage: node svg2drawio.js gen/*.svg [--reset]   (writes drawio/<name>.drawio; an existing file is kept unless --reset)
// CAUTION: --reset overwrites draw.io edits.
const fs = require('fs'), path = require('path');
const xa = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const un = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const n1 = v => +(+v).toFixed(1);
const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

function convert(svg) {
  const cells = []; let id = 2;
  const vtx = (x, y, w, h, value, style) => cells.push(`<mxCell id="c${id++}" value="${xa(value)}" style="html=0;fontFamily=Arial;${style}" vertex="1" parent="1"><mxGeometry x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" as="geometry"/></mxCell>`);
  const edg = (pts, style) => {
    const [s, ...rest] = pts, t = rest.pop();
    const mid = rest.map(p => `<mxPoint x="${n1(p[0])}" y="${n1(p[1])}"/>`).join('');
    cells.push(`<mxCell id="c${id++}" value="" style="html=0;rounded=0;endFill=1;endSize=6;${style}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${n1(s[0])}" y="${n1(s[1])}" as="sourcePoint"/><mxPoint x="${n1(t[0])}" y="${n1(t[1])}" as="targetPoint"/>${mid ? `<Array as="points">${mid}</Array>` : ''}</mxGeometry></mxCell>`);
  };
  const paint = a => `fillColor=${a.fill && a.fill !== 'none' ? a.fill : 'none'};strokeColor=${a.stroke || 'none'};strokeWidth=${a['stroke-width'] || 1};${a.opacity ? `opacity=${a.opacity * 100};` : ''}`;
  const line = a => `strokeColor=${a.stroke || '#333333'};strokeWidth=${a['stroke-width'] || 1};endArrow=${a['marker-end'] ? 'block' : 'none'};${a['stroke-dasharray'] ? `dashed=1;dashPattern=${a['stroke-dasharray']};` : ''}`;
  svg = svg.replace(/<defs>[\s\S]*?<\/defs>/g, ''); // arrow markers are not shapes
  for (const m of svg.matchAll(/<(rect|text|line|circle|polygon|path)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
    const [, tag, raw, body] = m, a = attrs(raw);
    if (tag === 'rect') {
      if (a.x === undefined) continue; // the white page background; the draw.io export adds its own
      const rx = +(a.rx || 0);
      vtx(+a.x, +a.y, +a.width, +a.height, '', `${rx ? `rounded=1;absoluteArcSize=1;arcSize=${2 * rx};` : 'rounded=0;'}${paint(a)}`);
    } else if (tag === 'text') {
      // A label box around the SVG baseline: the text centre is about a third of the font size above the baseline.
      const size = +(a['font-size'] || 12), s = un(body), w = s.length * size * 0.62 + 4, h = size * 1.4, cy = +a.y - size / 3;
      const al = { start: 'left', middle: 'center', end: 'right' }[a['text-anchor'] || 'start'];
      const x = al === 'left' ? +a.x : al === 'center' ? +a.x - w / 2 : +a.x - w;
      vtx(x, cy - h / 2, w, h, s, `text;align=${al};verticalAlign=middle;spacing=0;spacingLeft=0;spacingRight=0;spacingTop=0;spacingBottom=0;fontSize=${size};fontColor=${a.fill || '#1a1a1a'};fontStyle=${a['font-weight'] === '700' ? 1 : 0};fillColor=none;strokeColor=none;`);
    } else if (tag === 'line') {
      edg([[+a.x1, +a.y1], [+a.x2, +a.y2]], line(a));
    } else if (tag === 'circle') {
      vtx(a.cx - a.r, a.cy - a.r, 2 * a.r, 2 * a.r, '', `ellipse;${paint(a)}`);
    } else {
      // Points of a polygon, or of a path made of M, L, H, V and their relative forms.
      let pts = [];
      if (tag === 'polygon') pts = a.points.trim().split(/\s+/).map(p => p.split(',').map(Number));
      else {
        let x = 0, y = 0;
        for (const [, c, v] of a.d.matchAll(/([MLHVZmlhvz])([^MLHVZmlhvz]*)/g)) {
          const n = v.trim().split(/[\s,]+/).filter(Boolean).map(Number);
          if (c === 'M' || c === 'L') [x, y] = n; else if (c === 'm' || c === 'l') { x += n[0]; y += n[1]; }
          else if (c === 'H') x = n[0]; else if (c === 'h') x += n[0]; else if (c === 'V') y = n[0]; else if (c === 'v') y += n[0]; else continue;
          pts.push([x, y]);
        }
      }
      if (tag === 'polygon' || (a.fill && a.fill !== 'none')) {
        // shortcut: every filled shape in these figures is a diamond, so it becomes a rhombus over its bounding box.
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        vtx(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), '', `rhombus;${paint(a)}`);
      } else edg(pts, line(a));
    }
  }
  return cells;
}

function toDrawio(name, svg, reset = process.argv.includes('--reset')) {
  const file = path.join(__dirname, 'drawio', `${name}.drawio`);
  if (fs.existsSync(file) && !reset) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `<mxfile host="svg2drawio.js"><diagram name="${name}"><mxGraphModel grid="0" page="0" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${convert(svg).join('')}</root></mxGraphModel></diagram></mxfile>`);
  return true;
}
module.exports = { toDrawio };

if (require.main === module) {
  for (const f of process.argv.slice(2).filter(a => a !== '--reset')) {
    const name = path.basename(f, '.svg');
    console.log(toDrawio(name, fs.readFileSync(f, 'utf8')) ? `created drawio/${name}.drawio` : `kept drawio/${name}.drawio`);
  }
}
