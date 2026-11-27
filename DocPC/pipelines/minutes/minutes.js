// Builds meeting minutes and progress sheets in the built-in form (coloured bars, 5 parts; progress sheet on a
// landscape page). The content comes from minutes.json. If the user's or the lecturer's sample differs, change the layout here.
// The minutes pipeline runs it, then exports the PDF and checks it.
// Usage by hand: node minutes.js   (in Source/; writes Outputs/<output>.docx)
// Write only real meeting facts. If the user lets the model choose dates, times or places, record that in the context file.
const fs = require('fs'), path = require('path');
const { OUTPUTS, readJson } = require('../../lib/paths.js');
const { formParts } = require('../../lib/form-docx.js');
const { Document, Packer, Table, TableRow, WidthType, AlignmentType, PageOrientation } = require('docx');
const FONT = 'Arial', PURPLE = '800080', LABEL = 'E0E0E0';
const { para, cell, txt } = formParts({ font: FONT, size: 19, gap: 30, margin: 40 });
const lab = (t, w, span) => txt(t, w, { bold: true, fill: LABEL, span });
const bar = t => new TableRow({ children: [cell([para(t, { bold: true, color: 'FFFFFF' })], 9360, { span: 4, fill: PURPLE })] });
const title = t => para(t, { bold: true, size: 40, color: PURPLE, before: 0, after: 120 });
const q = 2340;

function minutes(M, m) {
  const chair = m.chair || M.members[0], taker = m.minuteTaker || chair, present = m.present || M.members, absent = m.absent || [];
  const rows = [
    new TableRow({ children: [lab('Meeting/Project Name:', q), txt(M.project, q * 3, { span: 3 })] }),
    new TableRow({ children: [lab('Date of Meeting:', q), txt(m.date, q), lab('Start time:', q), txt(m.start, q)] }),
    new TableRow({ children: [lab('Location:', q), txt(m.place, q), lab('End time:', q), txt(m.end, q)] }),
    new TableRow({ children: [lab('Chair:', q), txt(chair, q), lab('Minute taker:', q), txt(taker, q)] }),
    bar('1. Meeting Objective(s)'),
    new TableRow({ children: [cell(m.objectives.map(o => para(o)), q * 4, { span: 4 })] }),
    bar('2. Attendance'),
    new TableRow({ children: [lab('Present', q * 3, 3), lab('Apologies', q)] }),
    ...Array.from({ length: Math.max(present.length, absent.length) }, (_, i) =>
      new TableRow({ children: [txt(present[i] || '', q * 3, { span: 3, dotted: true }), txt(absent[i] || '', q, { dotted: true })] })),
    bar('3. Agenda, Decisions, Issues'),
    new TableRow({ children: [lab('Topic/ Discussion notes', q * 3, 3), lab('Discussion led by', q)] }),
    // A topic is [title, [notes], led by (optional)].
    ...m.topics.map(([t, notes, led]) => new TableRow({ children: [cell([para(t), ...notes.map(s => para('•  ' + s, { indent: { left: 400 } }))], q * 3, { span: 3, dotted: true }), txt(led || chair, q, { dotted: true })] })),
    bar('4. Action Items'),
    new TableRow({ children: [lab('Action', q * 2, 2), lab('Responsible', q), lab('Due Date', q)] }),
    // An action is [action, due date] or [action, responsible, due date].
    ...m.actions.map(a => { const [act, who, due] = a.length === 2 ? [a[0], chair, a[1]] : a;
      return new TableRow({ children: [txt(act, q * 2, { span: 2, dotted: true }), txt(who, q, { dotted: true }), txt(due, q, { dotted: true })] }); }),
    bar('5. Next Meeting'),
    new TableRow({ children: [lab('Date:', q), txt(m.next.date, q), lab('Time / Location:', q), txt(m.next.where, q)] }),
    new TableRow({ children: [lab('Objective(s):', q), txt(m.next.objective, q * 3, { span: 3 })] }),
  ];
  return [title(`MEETING MINUTES ${m.n}`), new Table({ width: { size: q * 4, type: WidthType.DXA }, columnWidths: [q, q, q, q], rows })];
}

// A progress row is [task, start, end, priority, status] or the same with the person assigned as a 6th item.
// Status is 'Complete', 'In progress' or 'Not started'. One sheet must fit on one landscape page.
function progress(M, p) {
  const cw = [2800, 1300, 1300, 900, 2300, 1400, 2000, 1680];
  const hdr = ['Task Name', 'Start Date', 'End Date', 'Priority', 'Assigned To (Full Name)', 'Completion Status', 'Lecturer Comments', 'Group Leader Comments'];
  const rows = [new TableRow({ tableHeader: true, children: hdr.map((h, i) => cell([para(h, { bold: true, size: 17, before: 10, after: 10, align: AlignmentType.CENTER })], cw[i], { fill: LABEL })) }),
    ...p.rows.map(t => new TableRow({ children: [t[0], t[1], t[2], t[3], t[5] || M.members[0], t[4], '', p.leaderComment ?? 'Null']
      .map((v, i) => cell([para(v, { bold: i === 0, size: 17, before: 10, after: 10, align: AlignmentType.CENTER })], cw[i])) }))];
  return [title(`PROGRESS SHEET ${p.n}`), new Table({ width: { size: 13680, type: WidthType.DXA }, columnWidths: cw, rows })];
}

const portrait = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1273, right: 1273 } } };
const landscape = { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } };
const weekHead = p => para(`WEEK ${p.week}: ${p.weekDate}`, { bold: true, size: 22, before: 0, after: 80 });
// Writes Outputs/<output>.docx and returns its path.
async function build() {
  const M = readJson('minutes.json');
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 19 } } } },
    sections: M.pages.map(p => ({ properties: p.type === 'progress' ? landscape : portrait, children: [weekHead(p), ...(p.type === 'progress' ? progress(M, p) : minutes(M, p))] })),
  });
  const out = path.join(OUTPUTS, `${M.output}.docx`);
  fs.mkdirSync(OUTPUTS, { recursive: true });
  fs.writeFileSync(out, await Packer.toBuffer(doc));
  console.log('written', out, `(${M.pages.length} pages)`);
  return out;
}

module.exports = { build };
if (require.main === module) build().catch(e => { console.error(e.message); process.exitCode = 1; });
