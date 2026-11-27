// Assemble pipeline: text (body.docx) -> Word assembly (cover, figures, contents lists) -> Outputs/<output>.docx and
// .pdf -> check. Run the diagram pipelines first, so that every [[FIG:key]] has its figures/<key> file.
// Usage: node <skill>/run.js assemble
const path = require('path');
const { build } = require('../text/build.js');
const { checkPdf } = require('../check/pipeline.js');
const { readJson } = require('../../lib/paths.js');

module.exports = {
  description: "The full document: text, the cover of the lecturer's template, figures and contents lists, as .docx and .pdf, then the check",
  needs: 'Windows with Microsoft Word',
  data: ['doc.json', 'content.js'],
  async run(ctx) {
    await build();
    ctx.ps(path.join(__dirname, 'assemble.ps1'), ['-Source', ctx.source]);
    checkPdf(ctx, path.join(ctx.outputs, `${readJson('doc.json').output}.pdf`));
  },
};
