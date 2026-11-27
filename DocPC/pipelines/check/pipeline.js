// Check pipeline: checks a built PDF and renders pages to PNG, so the model can look at them.
// Usage: node <skill>/run.js check <file.pdf> [--landscape] [--pages "1,5"]
// The PNGs go to Source/render/<pdf name>-<page>.png. Other pipelines call checkPdf() after they build a PDF.
const path = require('path');

function checkPdf(ctx, pdf, { landscape = false } = {}) {
  ctx.ps(path.join(__dirname, 'check.ps1'), ['-Pdf', pdf, ...(landscape ? ['-AllowLandscape'] : [])], { soft: true });
}

// Exports a Word file to a PDF next to it with Word (lib/pdf.ps1), checks the PDF and returns its path.
function pdfAndCheck(ctx, docx, options) {
  const pdf = docx.replace(/\.docx$/, '.pdf');
  ctx.ps(path.join(ctx.skill, 'lib', 'pdf.ps1'), [docx]);
  checkPdf(ctx, pdf, options);
  return pdf;
}

function renderPdf(ctx, pdf, pages, prefix) {
  const out = prefix || ctx.src('render', `${path.basename(pdf, '.pdf')}-`);
  ctx.ps(path.join(__dirname, 'render.ps1'), ['-Pdf', pdf, '-Out', out, ...(pages ? ['-Pages', pages] : [])]);
}

module.exports = {
  description: 'Check a built PDF (pages, placeholders, broken fields, notes, cut captions) and render pages to PNG',
  needs: 'Windows (PDF engine); pdftotext for the text checks',
  data: [],
  checkPdf,
  pdfAndCheck,
  renderPdf,
  run(ctx, args) {
    const pdf = args.find(a => a.toLowerCase().endsWith('.pdf'));
    if (!pdf) throw new Error('Usage: node run.js check <file.pdf> [--landscape] [--pages "1,5"]');
    const at = args.indexOf('--pages');
    checkPdf(ctx, path.resolve(pdf), { landscape: args.includes('--landscape') });
    renderPdf(ctx, path.resolve(pdf), at >= 0 ? args[at + 1] : '');
  },
};
