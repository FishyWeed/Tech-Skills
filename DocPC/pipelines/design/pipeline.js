// Design pipeline: design.json -> drawio/<name>.drawio (only if missing) -> figures/<name>.svg -> line-end check.
// Usage: node <skill>/run.js design [name ...] [--reset]
// Run it again after an edit in draw.io: the .drawio file is kept and exported again.
const { build } = require('./design.js');
const { exportOrStop } = require('../../lib/drawio-export.js');
const { checkTouch } = require('../check/touch.js');

module.exports = {
  description: "Context diagram, DFDs and a Crow's Foot ERD from design.json, as draw.io files and figures",
  needs: 'Microsoft Edge and internet access (draw.io viewer) for the export',
  data: ['design.json'],
  run(ctx, args) {
    const names = build(args.filter(a => a !== '--reset'), args.includes('--reset'));
    exportOrStop(names, 'diagrams');
    // Every arrow head and line end must touch its shape.
    ctx.problems += checkTouch(names.map(n => ctx.src('figures', `${n}.svg`)));
  },
};
