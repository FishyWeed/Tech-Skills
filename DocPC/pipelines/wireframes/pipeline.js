// Wireframes pipeline: wireframe.json -> gen/<screen>.svg -> drawio/<screen>.drawio (only if missing) -> figures/<screen>.svg.
// Usage: node <skill>/run.js wireframes [screen ...] [--reset]
// Run it again after an edit in draw.io: the .drawio file is kept and exported again.
const { build } = require('./wireframe.js');
const { fromGen } = require('../../lib/svg2drawio.js');
const { exportOrStop } = require('../../lib/drawio-export.js');

module.exports = {
  description: 'Low-fidelity wireframes (desktop or mobile) from wireframe.json, as draw.io files and figures',
  needs: 'Microsoft Edge and internet access (draw.io viewer) for the export',
  data: ['wireframe.json'],
  run(ctx, args) {
    const names = build(args.filter(a => a !== '--reset'));
    fromGen(names, args.includes('--reset'));
    exportOrStop(names, 'wireframes');
  },
};
