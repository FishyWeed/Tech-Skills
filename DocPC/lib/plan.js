// The project plan (plan.json), for the Gantt chart and the plan table. A group row (id ends in .0) takes its start
// (s) and end (e) from its tasks.
const { readJson } = require('./paths.js');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function readPlan() {
  const plan = readJson('plan.json');
  return plan.map(row => {
    if (!row.group) return row;
    const tasks = plan.filter(t => !t.group && t.id.startsWith(row.id.replace(/\.0$/, '.')));
    if (!tasks.length) throw new Error(`plan.json: group ${row.id} has no tasks`);
    return { ...row, s: tasks.map(t => t.s).sort()[0], e: tasks.map(t => t.e).sort().at(-1) };
  });
}

module.exports = { MONTHS, readPlan };
