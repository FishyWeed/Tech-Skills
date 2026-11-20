// Builds the body of the document (everything after the cover) as body.docx. assemble.ps1 then adds the cover,
// the figures and the contents lists. Usage: node body.js
// [[...]] paragraphs are placeholders: [[COVER]], [[TOC]], [[LOF]], [[LOT]] and [[FIG:key]] (key = file name in figures/).
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType,
  LevelFormat, HeadingLevel, SequentialIdentifier, ExternalHyperlink, Header, Footer, PageNumber, TabStopType } = require('docx');
const cfg = JSON.parse(fs.readFileSync(__dirname + '/doc.json', 'utf8'));
const plan = JSON.parse(fs.readFileSync(__dirname + '/plan.json', 'utf8'));

const FONT = cfg.font, SIZE = cfg.fontSize * 2, TEXT_W = 9026; // A4 with 1 inch margins: 9026 twips of text width
let listInstance = 0;

// ---------- Figure and table numbers ----------
// List every figure and table key here in document order. fig('gantt') gives 'Figure 1', so the text can refer to
// a figure before or after it. The build stops if the order of figure() / caption calls differs from these lists.
const FIGURES = ['gantt', 'hierarchy'];
const TABLES = ['plan'];
const fig = k => { const i = FIGURES.indexOf(k); if (i < 0) throw new Error('unknown figure ' + k); return `Figure ${i + 1}`; };
const tab = k => { const i = TABLES.indexOf(k); if (i < 0) throw new Error('unknown table ' + k); return `Table ${i + 1}`; };
const used = { Figure: [], Table: [] };

// ---------- Helpers ----------
// Inline markup: **bold** and *italic*.
const runs = (s, size) => String(s).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).filter(Boolean).map(t =>
  t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true, size }) : t.startsWith('*') ? new TextRun({ text: t.slice(1, -1), italics: true, size }) : new TextRun({ text: t, size }));
const P = (s, o = {}) => new Paragraph({ children: runs(s), alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, ...o });
const H1 = s => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(s)] });
const H2 = s => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s)] });
const H3 = s => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(s)] });
// A heading of the front part (contents, lists, acknowledgement): centred and not numbered in the contents.
const FRONT = (s, brk = true) => new Paragraph({ style: 'FrontHeading', pageBreakBefore: brk, children: [new TextRun(s)] });
const HOLD = key => new Paragraph({ children: [new TextRun(`[[${key}]]`)] });
const bullets = (items, level = 0) => items.map(s => new Paragraph({ children: runs(s), numbering: { reference: 'bullets', level }, spacing: { after: 60 } }));
const numbered = items => { const instance = ++listInstance; return items.map(s => new Paragraph({ children: runs(s), numbering: { reference: 'numbers', level: 0, instance }, spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED })); };
const caption = (label, key, s) => {
  used[label].push(key);
  return new Paragraph({ style: 'Caption', keepNext: label === 'Table', children: [new TextRun(`${label} `), new SequentialIdentifier(label), new TextRun(`: ${s}`)] });
};
const figure = (key, s) => [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [new TextRun(`[[FIG:${key}]]`)] }), caption('Figure', key, s)];
// A note for a fact that is not known yet (results, real users, meeting facts). The user or a later build replaces it.
const TODO = s => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300, after: 300 }, children: [new TextRun({ text: `[${s}]`, italics: true })] });

const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const borders = { top: border, bottom: border, left: border, right: border };
// widths are relative (for example [1, 3, 1]); the table fills the text width.
function table(head, rows, widths, size = SIZE - 4) {
  const total = widths.reduce((a, b) => a + b, 0), w = widths.map(x => Math.round(x * TEXT_W / total));
  const cell = (s, i, isHead) => new TableCell({ borders, width: { size: w[i], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: isHead ? { fill: 'D9E2F3', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: String(s).split('\n').map(t => new Paragraph({ spacing: { line: 260, after: 0 }, children: isHead ? [new TextRun({ text: t, bold: true, size })] : runs(t, size) })) });
  return new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w,
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) }), ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) }))] });
}
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });
// A reference in a hanging indent, with an optional link.
const ref = (s, url) => new Paragraph({ indent: { left: 720, hanging: 720 }, spacing: { after: 160 }, alignment: AlignmentType.LEFT,
  children: [...runs(s), ...(url ? [new TextRun(' '), new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: 'Hyperlink' })] })] : [])] });

// The project plan as table rows. A group row (id ends in .0) takes its dates from its tasks.
const fmt = d => { const [y, m, dd] = d.split('-'); return `${+dd} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]} ${y}`; };
const days = (s, e) => (Date.parse(e) - Date.parse(s)) / 864e5 + 1;
const kidsOf = r => plan.filter(k => !k.group && k.id.startsWith(r.id.replace(/\.0$/, '.')));
const planRows = plan.map(r => {
  if (!r.group) return [r.id, r.name, `${days(r.s, r.e)} days`, fmt(r.s), fmt(r.e), r.status];
  const kids = kidsOf(r);
  if (!kids.length) throw new Error(`group ${r.id} has no tasks`);
  const s = kids.map(k => k.s).sort()[0], e = kids.map(k => k.e).sort().at(-1);
  return [`**${r.id}**`, `**${r.name}**`, `**${days(s, e)} days**`, `**${fmt(s)}**`, `**${fmt(e)}**`, ''];
});

// ---------- Content ----------
// Follow the heading order of the lecturer's template. Replace this example content.
const children = [
  HOLD('COVER'),
  FRONT('TABLE OF CONTENTS'), HOLD('TOC'),
  FRONT('LIST OF FIGURES'), HOLD('LOF'),
  FRONT('LIST OF TABLES'), HOLD('LOT'),

  H1('1.0 Introduction'),
  P(`This paragraph is an example. ${tab('plan')} shows the project plan and ${fig('gantt')} shows it as a Gantt chart.`),
  ...bullets(['A bullet point with **bold** text.', 'A bullet point with *italic* text.']),
  TODO('Example note: add the results after the tests'),

  H1('2.0 Project Plan'),
  caption('Table', 'plan', 'Project plan'),
  table(['ID', 'Task', 'Duration', 'Start', 'End', 'Status'], planRows, [1.1, 3.2, 1, 1.2, 1.2, 1]),
  gap(),
  ...figure('gantt', 'Gantt chart'),
  ...figure('hierarchy', 'Hierarchy chart'),

  H1('References'),
  ref('Author, A. (2026) *Title of the source*. Publisher. Available at:', 'https://example.com'),
];
for (const [label, list] of [['Figure', FIGURES], ['Table', TABLES]])
  if (used[label].join() !== list.join()) throw new Error(`${label} order is ${used[label].join(', ')}; the list says ${list.join(', ')}`);

// ---------- Page setup ----------
const heading = (id, name, size, o = {}) => ({ id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
  run: { font: FONT, size, bold: true, italics: !!o.italics }, paragraph: { spacing: { before: o.before ?? 240, after: 120, line: 300 }, keepNext: true, keepLines: true, outlineLevel: o.level } });
const small = { bold: true, size: 18 };
const header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }], border: { bottom: { ...border, space: 4 } },
  children: [new TextRun({ text: cfg.header, ...small }), new TextRun({ text: '\tPage ', ...small }), new TextRun({ children: [PageNumber.CURRENT], ...small }),
    new TextRun({ text: ' of ', ...small }), new TextRun({ children: [PageNumber.TOTAL_PAGES], ...small })] })] });
const footer = new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.CENTER, position: TEXT_W / 2 }, { type: TabStopType.RIGHT, position: TEXT_W }],
  border: { top: { ...border, space: 4 } }, children: [new TextRun({ text: cfg.footer.join('\t'), size: 18 })] })] });

const doc = new Document({
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
Packer.toBuffer(doc).then(b => { fs.writeFileSync(__dirname + '/body.docx', b); console.log('body.docx written', b.length); });
