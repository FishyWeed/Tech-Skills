// Turns the report of the project's own automated tests into tests-auto.json, which content.js shows through tests.js.
// It reads two report formats:
//   JUnit XML: pytest --junitxml=report.xml, PHPUnit --log-junit report.xml, Maven Surefire, and Vitest, Mocha or
//              Jest with a JUnit reporter.
//   Jest JSON: jest --json --outputFile=report.json
// The test pipeline runs it for each report in the "reports" list of tests.json.
// Usage by hand: node import.js <report> [more reports]   (in Source/)
//                node import.js --self-test               (checks the two readers on small built-in reports)
// Run the tests first: this script only reads their report, and it never changes the report.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { src } = require('../../lib/paths.js');

const { unescapeXml, parseAttrs } = require('../../lib/xml.js');
const firstLine = s => unescapeXml(s || '').trim().split(/\r?\n/)[0].slice(0, 200);
const attrs = s => Object.fromEntries(Object.entries(parseAttrs(s)).map(([k, v]) => [k, unescapeXml(v)]));

// shortcut: a regex reader, not a full XML parser. It reads the <testcase> elements in order (also in nested
// <testsuite> elements) and takes the suite from classname or the last <testsuite> name. Use an XML package if a
// tool writes an unusual report.
function junit(xml, file) {
  const tests = [];
  let suiteName = '';
  for (const [, suiteAttrs, raw, inner = ''] of xml.matchAll(/<testsuite\b([^>]*?)\/?>|<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    if (suiteAttrs !== undefined) { suiteName = attrs(suiteAttrs).name || suiteName; continue; }
    const a = attrs(raw), fail = inner.match(/<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/);
    const status = fail ? 'failed' : /<skipped\b/.test(inner) ? 'skipped' : 'passed';
    tests.push({ suite: a.classname || suiteName || path.basename(file), name: a.name, status,
      ms: Math.round((+a.time || 0) * 1000), message: fail ? firstLine(attrs(fail[2]).message || fail[3]) : '' });
  }
  return tests;
}

function jest(json, file) {
  return json.testResults.flatMap(r => (r.assertionResults || []).map(t => ({
    suite: path.basename(r.name || r.testFilePath || file), name: [...(t.ancestorTitles || []), t.title].join(' > '),
    status: t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped',
    ms: t.duration || 0, message: firstLine((t.failureMessages || [])[0]) })));
}

function read(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.trimStart().startsWith('<')) return junit(text, file);
  const json = JSON.parse(text);
  if (!Array.isArray(json.testResults)) throw new Error(`${file}: not a JUnit XML or Jest JSON report`);
  return jest(json, file);
}

function selfTest() {
  const x = junit(`<testsuites><testsuite name="auth"><testcase classname="tests.test_login" name="test_ok" time="0.012"/>
    <testcase classname="tests.test_login" name="test_bad" time="0.5"><failure message="assert 1 == 2">long trace</failure></testcase>
    <testcase name="test_later"><skipped/></testcase></testsuite></testsuites>`, 'r.xml');
  assert.deepStrictEqual(x.map(t => [t.suite, t.name, t.status, t.ms]), [['tests.test_login', 'test_ok', 'passed', 12],
    ['tests.test_login', 'test_bad', 'failed', 500], ['auth', 'test_later', 'skipped', 0]]);
  assert.strictEqual(x[1].message, 'assert 1 == 2');
  // PHPUnit nests suites; a case after an inner suite must not be lost.
  const n = junit(`<testsuites><testsuite name="All"><testsuite name="Unit"><testcase name="a"/></testsuite>
    <testcase name="b"><error message="Boom &amp; more"/></testcase></testsuite></testsuites>`, 'n.xml');
  assert.deepStrictEqual(n.map(t => [t.name, t.status, t.message]), [['a', 'passed', ''], ['b', 'failed', 'Boom & more']]);
  const j = jest({ testResults: [{ name: '/app/login.test.js', assertionResults: [
    { ancestorTitles: ['Login'], title: 'works', status: 'passed', duration: 5 },
    { ancestorTitles: ['Login'], title: 'fails', status: 'failed', failureMessages: ['Error: expected 200\n    at line 4'] },
    { ancestorTitles: [], title: 'later', status: 'todo' }] }] }, 'r.json');
  assert.deepStrictEqual(j.map(t => [t.suite, t.name, t.status]), [['login.test.js', 'Login > works', 'passed'],
    ['login.test.js', 'Login > fails', 'failed'], ['login.test.js', 'later', 'skipped']]);
  assert.strictEqual(j[1].message, 'Error: expected 200');
  console.log('self-test passed');
}

// Reads the reports (paths relative to Source/ or absolute), writes tests-auto.json and prints the counts.
function importReports(files) {
  const full = files.map(f => path.resolve(src(), f)), tests = full.flatMap(read);
  const date = new Date(Math.max(...full.map(f => fs.statSync(f).mtimeMs))).toISOString().slice(0, 10);
  fs.writeFileSync(src('tests-auto.json'), JSON.stringify({ reports: full.map(f => path.basename(f)), date, tests }, null, 2));
  const n = s => tests.filter(t => t.status === s).length;
  console.log(`tests-auto.json written: ${tests.length} tests, ${n('passed')} passed, ${n('failed')} failed, ${n('skipped')} skipped (report date ${date})`);
}

module.exports = { importReports, selfTest };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (files[0] === '--self-test') selfTest();
  else if (!files.length) { console.error('Usage: node import.js <report.xml | report.json> [more reports]'); process.exitCode = 1; }
  else importReports(files);
}
