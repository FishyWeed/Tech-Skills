// Charts pipeline: charts.json (and plan.json) -> gen/<name>.svg -> drawio/<name>.drawio (only if missing) -> figures/<name>.svg.
// Usage: node <skill>/run.js charts [name ...] [--reset]
// Run it again after an edit in draw.io: the .drawio file is kept and exported again.
const { build } = require('./charts.js');
const { fromGen } = require('../../lib/svg2drawio.js');
const { exportOrStop } = require('../../lib/drawio-export.js');

module.exports = {
  description: 'A Gantt chart from plan.json and hierarchy charts from charts.json, as draw.io files and figures',
  needs: 'Microsoft Edge and internet access (draw.io viewer) for the export',
  data: ['charts.json'],
  run(ctx, args) {
    const names = build(args.filter(a => a !== '--reset'));
    fromGen(names, args.includes('--reset'));
    exportOrStop(names, 'charts');
  },
};
