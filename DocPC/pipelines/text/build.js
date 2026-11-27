// Text pipeline step: builds the body of the document (everything after the cover) as Source/body.docx from
// Source/content.js and Source/doc.json. The assemble pipeline then adds the cover, the figures and the contents lists.
// Usage by hand: node build.js   (in Source/)
// [[...]] paragraphs are placeholders: [[COVER]], [[TOC]], [[LOF]], [[LOT]] and [[FIG:key]] (key = file name in figures/).
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType,
  LevelFormat, HeadingLevel, SequentialIdentifier, ExternalHyperlink, Header, Footer, PageNumber, TabStopType } = require('docx');
const { src, readJson } = require('../../lib/paths.js');
const { MONTHS, readPlan } = require('../../lib/plan.js');
const pseudoFile = require('../pseudocode/pseudo.js');

const TEXT_W = 9026; // A4 with 1 inch margins: 9026 twips of text width
const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const borders = { top: border, bottom: border, left: border, right: border };

// The project plan as table rows; a group row is bold.
function planRows() {
  const date = d => { const [y, m, day] = d.split('-'); return `${+day} ${MONTHS[+m - 1]} ${y}`; };
  const days = (s, e) => (Date.parse(e) - Date.parse(s)) / 864e5 + 1;
  return readPlan().map(r => r.group
    ? [`**${r.id}**`, `**${r.name}**`, `**${days(r.s, r.e)} days**`, `**${date(r.s)}**`, `**${date(r.e)}**`, '']
    : [r.id, r.name, `${days(r.s, r.e)} days`, date(r.s), date(r.e), r.status]);
}

// Inline markup: **bold** and *italic*.
const runs = (s, size) => String(s).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).filter(Boolean).map(t =>
  t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true, size }) : t.startsWith('*') ? new TextRun({ text: t.slice(1, -1), italics: true, size }) : new TextRun({ text: t, size }));

// A table that fills the text width. widths are relative (for example [1, 3, 1]); size is the font size in half points.
function table(head, rows, widths, size) {
  const total = widths.reduce((a, b) => a + b, 0), w = widths.map(x => Math.round(x * TEXT_W / total));
  const cell = (s, i, isHead) => new TableCell({ borders, width: { size: w[i], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: isHead ? { fill: 'D9E2F3', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: String(s).split('\n').map(t => new Paragraph({ spacing: { line: 260, after: 0 }, children: isHead ? [new TextRun({ text: t, bold: true, size })] : runs(t, size) })) });
  return new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w,
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) }), ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) }))] });
}

// pseudo/<key>.txt in a grey box, in Courier New with the keywords in bold. The last line keeps the box with its caption.
function pseudoBox(key) {
  const lines = pseudoFile.read(key);
  const para = (l, last) => new Paragraph({ indent: { left: l.match(/^ */)[0].length * 120 }, spacing: { line: 260, after: 0 }, keepNext: last,
    children: l.trim().split(/\b([A-Z]+)\b/).filter(Boolean).map(t => new TextRun({ text: t, bold: pseudoFile.KEYWORDS.has(t), font: 'Courier New', size: 20 })) });
  return new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [TEXT_W], rows: [new TableRow({ children: [new TableCell({
    borders, width: { size: TEXT_W, type: WidthType.DXA }, shading: { fill: 'F5F5F5', type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 120, bottom: 120, left: 200, right: 200 }, children: lines.map((l, i) => para(l, i === lines.length - 1)) })] })] });
}

// The helpers that content.js gets. figures and tables are the key lists of content.js, in document order.
function helpers(cfg, figures, tables) {
  const SIZE = cfg.fontSize * 2, used = { Figure: [], Table: [] };
  let listInstance = 0;
  const number = (label, list) => k => { const i = list.indexOf(k); if (i < 0) throw new Error(`unknown ${label.toLowerCase()} ${k}`); return `${label} ${i + 1}`; };
  const caption = (label, key, s) => {
    used[label].push(key);
    return new Paragraph({ style: 'Caption', keepNext: label === 'Table', children: [new TextRun(`${label} `), new SequentialIdentifier(label), new TextRun(`: ${s}`)] });
  };
  const h = {
    table: (head, rows, widths, size = SIZE - 4) => table(head, rows, widths, size),
    // pseudo('login', 'Pseudocode of the login') prints pseudo/login.txt with a figure caption.
    pseudo: (key, s) => [pseudoBox(key), caption('Figure', key, s)],
    used, runs, caption, planRows,
    fig: number('Figure', figures), tab: number('Table', tables),
    P: (s, o = {}) => new Paragraph({ children: runs(s), alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, ...o }),
    H1: s => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(s)] }),
    H2: s => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s)] }),
    H3: s => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(s)] }),
    // A heading of the front part (contents, lists, acknowledgement): centred and not numbered in the contents.
    FRONT: (s, brk = true) => new Paragraph({ style: 'FrontHeading', pageBreakBefore: brk, children: [new TextRun(s)] }),
    HOLD: key => new Paragraph({ children: [new TextRun(`[[${key}]]`)] }),
    bullets: (items, level = 0) => items.map(s => new Paragraph({ children: runs(s), numbering: { reference: 'bullets', level }, spacing: { after: 60 } })),
    numbered: items => { const instance = ++listInstance; return items.map(s => new Paragraph({ children: runs(s), numbering: { reference: 'numbers', level: 0, instance }, spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED })); },
    figure: (key, s) => [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [new TextRun(`[[FIG:${key}]]`)] }), caption('Figure', key, s)],
    // A note for a fact that is not known yet (results, real users, meeting facts). The user or a later build replaces it.
    TODO: s => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300, after: 300 }, children: [new TextRun({ text: `[${s}]`, italics: true })] }),
    gap: () => new Paragraph({ spacing: { after: 120 }, children: [] }),
    // A reference in a hanging indent, with an optional link.
    ref: (s, url) => new Paragraph({ indent: { left: 720, hanging: 720 }, spacing: { after: 160 }, alignment: AlignmentType.LEFT,
      children: [...runs(s), ...(url ? [new TextRun(' '), new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: 'Hyperlink' })] })] : [])] }),
  };
  // The test tables (test pipeline), loaded only when content.js uses them.
  Object.defineProperty(h, 'tests', { get: () => require('../test/tests.js') });
  return h;
}

// Page setup: A4, the header (module and page number), the footer (from doc.json), the styles and the lists.
function document(cfg, children) {
  const FONT = cfg.font, SIZE = cfg.fontSize * 2, small = { bold: true, size: 18 };
  const heading = (id, name, size, o = {}) => ({ id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { font: FONT, size, bold: true, italics: !!o.italics }, paragraph: { spacing: { before: o.before ?? 240, after: 120, line: 300 }, keepNext: true, keepLines: true, outlineLevel: o.level } });
  const header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }], border: { bottom: { ...border, space: 4 } },
    children: [new TextRun({ text: cfg.header, ...small }), new TextRun({ text: '\tPage ', ...small }), new TextRun({ children: [PageNumber.CURRENT], ...small }),
      new TextRun({ text: ' of ', ...small }), new TextRun({ children: [PageNumber.TOTAL_PAGES], ...small })] })] });
  const footer = new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.CENTER, position: TEXT_W / 2 }, { type: TabStopType.RIGHT, position: TEXT_W }],
    border: { top: { ...border, space: 4 } }, children: [new TextRun({ text: cfg.footer.join('\t'), size: 18 })] })] });
  return new Document({
    creator: cfg.author, title: cfg.title,
    styles: {
      default: { document: { run: { font: FONT, size: SIZE }, paragraph: { spacing: { line: Math.round(240 * cfg.lineSpacing) } } } },
      paragraphStyles: [
        heading('Heading1', 'Heading 1', SIZE + 4, { level: 0, before: 0 }), heading('Heading2', 'Heading 2', SIZE + 2, { level: 1 }),
        heading('Heading3', 'Heading 3', SIZE, { level: 2, italics: true }),
        { id: 'FrontHeading', name: 'Front Heading', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: SIZE + 4, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 }, keepNext: true } },
        { id: 'Caption', name: 'Caption', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: SIZE - 2, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200, line: 276 } } },
      ],
    },
    numbering: { config: [
      { reference: 'bullets', levels: [0, 1].map(level => ({ level, format: LevelFormat.BULLET, text: level ? '-' : '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, headers: { default: header }, footers: { default: footer }, children }],
  });
}

// Builds body.docx. The build stops if the order of the captions differs from the key lists in content.js, so the
// figure and table numbers in the text are always right.
async function build() {
  const cfg = readJson('doc.json'), file = src('content.js');
  if (!fs.existsSync(file)) throw new Error(`${file} is missing. Run "node <skill>/run.js init . text" to copy the example.`);
  delete require.cache[require.resolve(file)];
  const content = require(file), h = helpers(cfg, content.figures, content.tables);
  const children = content.body(h);
  for (const [label, list] of [['Figure', content.figures], ['Table', content.tables]])
    if (h.used[label].join() !== list.join()) throw new Error(`${label} order is ${h.used[label].join(', ') || 'empty'}; content.js says ${list.join(', ') || 'empty'}`);
  const b = await Packer.toBuffer(document(cfg, children));
  fs.writeFileSync(src('body.docx'), b);
  console.log(`body.docx written (${b.length} bytes)`);
}

module.exports = { build };
if (require.main === module) build().catch(e => { console.error(e.message); process.exitCode = 1; });
