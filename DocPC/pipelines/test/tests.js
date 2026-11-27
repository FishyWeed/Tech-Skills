// Turns tests.json, and tests-auto.json if import.js made it, into table rows for content.js (the helper "tests").
// A result that is not recorded shows a note in brackets, so check.ps1 reports it until a real test run fills it in.
// Usage in content.js: table([...], tests.caseRows(), [...]) and the other row functions below.
const fs = require('fs');
const { src, readJson } = require('../../lib/paths.js');
const T = readJson('tests.json');
const AUTO = fs.existsSync(src('tests-auto.json')) ? readJson('tests-auto.json') : null;
const NOTE = '[not run]', STATUS = ['Pass', 'Fail', 'Blocked'];

// Stop the build on a case that would print a wrong or empty table.
const ids = new Set();
for (const c of T.cases) {
  for (const k of ['id', 'module', 'title', 'expected']) if (!c[k]) throw new Error(`tests.json: a case has no ${k} (${c.id || c.title})`);
  if (!Array.isArray(c.steps) || !c.steps.length) throw new Error(`tests.json: ${c.id} has no steps`);
  if (ids.has(c.id)) throw new Error(`tests.json: two cases have the id ${c.id}`);
  if (c.status && !STATUS.includes(c.status)) throw new Error(`tests.json: ${c.id} status must be ${STATUS.join(', ')} or empty`);
  if (c.status && !c.actual) throw new Error(`tests.json: ${c.id} has a status but no actual result`);
  if (c.role && T.roles && !T.roles.includes(c.role)) throw new Error(`tests.json: ${c.id} role ${c.role} is not in roles`);
  ids.add(c.id);
}

const steps = c => c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
// The test plan: [ID, Module, Test case, Steps, Test data, Expected result]
const caseRows = () => T.cases.map(c => [c.id, c.module, c.title, steps(c), c.data || '-', c.expected]);
// The results: [ID, Test case, Expected result, Actual result, Status]
const resultRows = () => T.cases.map(c => [c.id, c.title, c.expected, c.actual || NOTE, c.status ? `**${c.status}**` : NOTE]);
// The summary by module: [Module, Cases, Pass, Fail, Blocked, Not run], with a bold total row.
function summaryRows() {
  const count = list => [list.length, ...STATUS.map(s => list.filter(c => c.status === s).length), list.filter(c => !c.status).length];
  const mods = [...new Set(T.cases.map(c => c.module))];
  return [...mods.map(m => [m, ...count(T.cases.filter(c => c.module === m))]), ['**Total**', ...count(T.cases).map(n => `**${n}**`)]];
}

const needAuto = () => { if (!AUTO) throw new Error('tests-auto.json does not exist: run the tests, put the report in the "reports" list of tests.json and run the test pipeline'); return AUTO; };
// Automated tests by suite: [Suite, Tests, Passed, Failed, Skipped], with a bold total row.
function autoSummaryRows() {
  const A = needAuto(), count = list => [list.length, ...['passed', 'failed', 'skipped'].map(s => list.filter(t => t.status === s).length)];
  const suites = [...new Set(A.tests.map(t => t.suite))];
  return [...suites.map(s => [s, ...count(A.tests.filter(t => t.suite === s))]), ['**Total**', ...count(A.tests).map(n => `**${n}**`)]];
}
// The failed automated tests: [Suite, Test, Message]
const autoFailRows = () => needAuto().tests.filter(t => t.status === 'failed').map(t => [t.suite, t.name, t.message || '-']);

module.exports = { T, AUTO, NOTE, caseRows, resultRows, summaryRows, autoSummaryRows, autoFailRows };
