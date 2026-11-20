// Builds meeting minutes and progress sheets in the built-in form (coloured bars, 5 parts; progress sheet on a
// landscape page). The content comes from minutes.json. If the user's or the lecturer's sample differs, change the layout here.
// Usage: node minutes.js   (writes ../Outputs/<output>.docx; then run pdf.ps1 on it)
// Write only real meeting facts. If the user lets the model choose dates, times or places, record that in the context file.
const fs = require('fs'), path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, PageOrientation, BorderStyle } = require('docx');
const M = JSON.parse(fs.readFileSync(__dirname + '/minutes.json', 'utf8'));
const CHAIR = M.members[0], FONT = 'Arial', PURPLE = '800080', LABEL = 'E0E0E0';
const solid = { style: BorderStyle.SINGLE, size: 4, color: '000000' }, dot = { style: BorderStyle.DOTTED, size: 4, color: '000000' };
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 19, bold: o.bold, color: o.color });
const para = (t, o = {}) => new Paragraph({ spacing: { before: o.before ?? 30, after: o.after ?? 30 }, alignment: o.align, indent: o.indent, children: [run(t, o)] });
const cell = (kids, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, columnSpan: o.span, margins: { top: 40, bottom: 40, left: 100, right: 100 },
  borders: { top: o.dotted ? dot : solid, bottom: o.dotted ? dot : solid, left: solid, right: solid },
  shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, children: kids });
const txt = (t, w, o = {}) => cell([para(t, { bold: o.bold, color: o.color, align: o.align })], w, o);
const lab = (t, w, span) => txt(t, w, { bold: true, fill: LABEL, span });
const bar = t => new TableRow({ children: [cell([para(t, { bold: true, color: 'FFFFFF' })], 9360, { span: 4, fill: PURPLE })] });
const title = t => para(t, { bold: true, size: 40, color: PURPLE, before: 0, after: 120 });
const q = 2340;

function minutes(m) {
  const chair = m.chair || CHAIR, taker = m.minuteTaker || chair, present = m.present || M.members, absent = m.absent || [];
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
function progress(p) {
  const cw = [2800, 1300, 1300, 900, 2300, 1400, 2000, 1680];
  const hdr = ['Task Name', 'Start Date', 'End Date', 'Priority', 'Assigned To (Full Name)', 'Completion Status', 'Lecturer Comments', 'Group Leader Comments'];
  const rows = [new TableRow({ tableHeader: true, children: hdr.map((h, i) => cell([para(h, { bold: true, size: 17, before: 10, after: 10, align: AlignmentType.CENTER })], cw[i], { fill: LABEL })) }),
    ...p.rows.map(t => new TableRow({ children: [t[0], t[1], t[2], t[3], t[5] || CHAIR, t[4], '', p.leaderComment ?? 'Null']
      .map((v, i) => cell([para(v, { bold: i === 0, size: 17, before: 10, after: 10, align: AlignmentType.CENTER })], cw[i])) }))];
  return [title(`PROGRESS SHEET ${p.n}`), new Table({ width: { size: 13680, type: WidthType.DXA }, columnWidths: cw, rows })];
}

const portrait = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1273, right: 1273 } } };
const landscape = { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } };
const weekHead = p => para(`WEEK ${p.week}: ${p.weekDate}`, { bold: true, size: 22, before: 0, after: 80 });
const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 19 } } } },
  sections: M.pages.map(p => ({ properties: p.type === 'progress' ? landscape : portrait, children: [weekHead(p), ...(p.type === 'progress' ? progress(p) : minutes(p))] })),
});
const out = path.join(__dirname, '..', 'Outputs', `${M.output}.docx`);
fs.mkdirSync(path.dirname(out), { recursive: true });
Packer.toBuffer(doc).then(b => { fs.writeFileSync(out, b); console.log('written', out, `(${M.pages.length} pages)`); });
