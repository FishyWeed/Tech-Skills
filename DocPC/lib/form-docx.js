// Word parts for the form pipelines (minutes, UAT pack): text runs, paragraphs and table cells with borders.
// size is in half points; gap is the space above and below a paragraph and margin the top and bottom cell margin (twips).
const { Paragraph, TextRun, TableCell, WidthType, ShadingType, BorderStyle } = require('docx');

const solid = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const dotted = { style: BorderStyle.DOTTED, size: 4, color: '000000' };

function formParts({ font, size, gap, margin }) {
  const run = (t, o = {}) => new TextRun({ text: t, font, size: o.size || size, bold: o.bold, color: o.color });
  const para = (t, o = {}) => new Paragraph({ spacing: { before: o.before ?? gap, after: o.after ?? gap }, alignment: o.align, indent: o.indent, children: [run(t, o)] });
  // o.span joins columns, o.fill shades the cell and o.dotted makes the top and bottom borders dotted.
  const cell = (kids, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, columnSpan: o.span,
    margins: { top: margin, bottom: margin, left: 100, right: 100 },
    borders: { top: o.dotted ? dotted : solid, bottom: o.dotted ? dotted : solid, left: solid, right: solid },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, children: kids });
  // A cell with text; each line of the text is a paragraph.
  const txt = (t, w, o = {}) => cell(String(t).split('\n').map(l => para(l, o)), w, o);
  return { run, para, cell, txt };
}

module.exports = { formParts };
