// Builds the UAT pack (user acceptance testing) from tests.json: one test script for each role, with empty result
// boxes for the tester, and a feedback form. The testers fill it in by hand; then put their real results in tests.json.
// The test pipeline runs it when tests.json has "uat": true, then exports the PDF and checks it.
// Usage by hand: node uat.js   (in Source/; writes Outputs/<output>.docx)
// The pack is always empty: never fill in a result, a name or a signature for a tester.
const fs = require('fs'), path = require('path');
const { Document, Packer, Paragraph, Table, TableRow, WidthType, AlignmentType } = require('docx');
const { T } = require('./tests.js');
const { OUTPUTS } = require('../../lib/paths.js');
const { formParts } = require('../../lib/form-docx.js');
const FONT = 'Arial', GREY = 'E0E0E0', W = 9360, BOX = '☐';
const { run, para, txt } = formParts({ font: FONT, size: 19, gap: 40, margin: 60 });
const head = (t, w) => txt(t, w, { bold: true, fill: GREY });
const tbl = (widths, rows) => new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows });
const title = (t, brk) => new Paragraph({ pageBreakBefore: brk, spacing: { after: 160 }, children: [run(t, { bold: true, size: 32 })] });
// Empty boxes for the tester's details: [label, empty, label, empty].
const fields = pairs => tbl([1800, 2880, 1800, 2880], pairs.map(([a, b]) => new TableRow({ children: [head(a, 1800), txt('', 2880), head(b, 1800), txt('', 2880)] })));

const casesOf = role => T.cases.filter(c => (c.role || T.roles[0]) === role);
function script(role, first) {
  const cases = casesOf(role), cw = [900, 3300, 2300, 1260, 1600];
  return [
    title(`User Acceptance Test Script: ${role}`, !first),
    para(`System: ${T.system}`, { bold: true, after: 120 }),
    fields([['Tester name', 'Date'], ['Role', 'Signature']]),
    para('Do each test in order. Tick Pass if the result is the expected result. If not, tick Fail and write what happened in Comments.', { before: 160, after: 160 }),
    tbl(cw, [
      new TableRow({ tableHeader: true, children: ['ID', 'Steps', 'Expected result', 'Result', 'Comments'].map((h, i) => head(h, cw[i])) }),
      ...cases.map(c => new TableRow({ cantSplit: true, children: [
        txt(c.id, cw[0]), txt([c.title, ...(c.pre ? [`Before: ${c.pre}`] : []), ...c.steps.map((s, i) => `${i + 1}. ${s}`)].join('\n'), cw[1]),
        txt(c.expected, cw[2]), txt(`${BOX} Pass\n${BOX} Fail`, cw[3]), txt('', cw[4])] })),
    ]),
  ];
}

function feedback() {
  const scale = T.feedback.filter(f => f.type === 'scale'), open = T.feedback.filter(f => f.type === 'text');
  const qw = 4460, nw = 980;
  return [
    title('User Feedback Form', true),
    para(`System: ${T.system}`, { bold: true, after: 120 }),
    fields([['Name', 'Date'], ['Role', 'Signature']]),
    ...(scale.length ? [
      para('Tick one box for each statement: 1 = strongly disagree, 5 = strongly agree.', { before: 160, after: 160 }),
      tbl([qw, nw, nw, nw, nw, nw], [
        new TableRow({ tableHeader: true, children: [head('Statement', qw), ...[1, 2, 3, 4, 5].map(n => txt(String(n), nw, { bold: true, fill: GREY, align: AlignmentType.CENTER }))] }),
        ...scale.map(f => new TableRow({ cantSplit: true, children: [txt(f.q, qw), ...[1, 2, 3, 4, 5].map(() => txt(BOX, nw, { align: AlignmentType.CENTER, size: 24 }))] })),
      ])] : []),
    ...open.flatMap(f => [para(f.q, { bold: true, before: 240 }), tbl([W], [new TableRow({ height: { value: 1600, rule: 'atLeast' }, children: [txt('', W)] })])]),
  ];
}

// Writes Outputs/<output>.docx and returns its path.
async function build() {
  if (!Array.isArray(T.roles) || !T.roles.length) throw new Error('tests.json: roles is empty');
  const children = [...T.roles.filter(r => casesOf(r).length).flatMap((r, i) => script(r, i === 0)), ...(T.feedback && T.feedback.length ? feedback() : [])];
  const doc = new Document({ styles: { default: { document: { run: { font: FONT, size: 19 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1273, right: 1273 } } }, children }] });
  const out = path.join(OUTPUTS, `${T.output || 'UAT-PACK'}.docx`);
  fs.mkdirSync(OUTPUTS, { recursive: true });
  fs.writeFileSync(out, await Packer.toBuffer(doc));
  console.log('written', out);
  return out;
}

module.exports = { build };
if (require.main === module) build().catch(e => { console.error(e.message); process.exitCode = 1; });
