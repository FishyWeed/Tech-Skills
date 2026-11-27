// Excel pipeline: xlsx.json -> a filled copy of the Excel template in Outputs/<output>.xlsx.
// Usage: node <skill>/run.js excel
// CAUTION: xlsx.json may name a signature image. Use it only when the user allows it for this form.
const path = require('path');

module.exports = {
  description: 'Fill an Excel form (for example a workload matrix) from xlsx.json, as a copy in Outputs/',
  needs: 'Windows with Microsoft Excel',
  data: ['xlsx.json'],
  run(ctx) {
    ctx.ps(path.join(__dirname, 'xlsx-fill.ps1'), ['-Source', ctx.source]);
  },
};
