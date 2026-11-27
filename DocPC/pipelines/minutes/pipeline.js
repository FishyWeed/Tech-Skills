// Minutes pipeline: minutes.json -> Outputs/<output>.docx -> .pdf -> check (landscape pages allowed).
// If minutes.json has "images": true, each page also becomes figures/<output>-<page>.png (rendered, white edges
// cut), so the report can show the forms with figure().
// Usage: node <skill>/run.js minutes
const fs = require('fs'), path = require('path');
const { build } = require('./minutes.js');
const { pdfAndCheck, renderPdf } = require('../check/pipeline.js');
const { readJson } = require('../../lib/paths.js');

module.exports = {
  description: 'Meeting minutes and progress sheets from minutes.json, as .docx and .pdf, then the check',
  needs: 'Windows with Microsoft Word for the PDF (the .docx needs only Node.js)',
  data: ['minutes.json'],
  async run(ctx) {
    const pdf = pdfAndCheck(ctx, await build(), { landscape: true }), M = readJson('minutes.json');
    if (!M.images) return;
    const page = ctx.src('render', `${M.output}-`), figure = ctx.src('figures', `${M.output}-`);
    fs.mkdirSync(ctx.src('figures'), { recursive: true });
    renderPdf(ctx, pdf, '', page);
    M.pages.forEach((p, i) => ctx.ps(path.join(__dirname, '..', 'check', 'crop.ps1'), [`${page}${i + 1}.png`, `${figure}${i + 1}.png`]));
  },
};
