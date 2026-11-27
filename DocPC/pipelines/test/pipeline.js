// Test pipeline: the automated test reports of tests.json -> tests-auto.json; tests.json checked and counted;
// with "uat": true, the UAT pack -> Outputs/<output>.docx -> .pdf -> check.
// The report tables come in the text pipeline, through the helper "tests" in content.js.
// Usage: node <skill>/run.js test
const { importReports } = require('./import.js');
const { pdfAndCheck } = require('../check/pipeline.js');
const { readJson } = require('../../lib/paths.js');

module.exports = {
  description: 'Test cases and real results from tests.json, automated test reports (JUnit XML, Jest JSON) and the UAT pack',
  needs: 'Windows with Microsoft Word for the UAT pack PDF (the rest needs only Node.js)',
  data: ['tests.json'],
  async run(ctx) {
    const reports = readJson('tests.json').reports || [];
    if (reports.length) importReports(reports);
    // Loaded after the import, so that tests.js sees the new tests-auto.json. It stops on a wrong case.
    const tests = require('./tests.js');
    const [, cases, pass, fail, blocked, notRun] = tests.summaryRows().at(-1).map(v => String(v).replace(/\*/g, ''));
    console.log(`tests.json: ${cases} cases, ${pass} pass, ${fail} fail, ${blocked} blocked, ${notRun} not run`);
    if (!tests.T.uat) return;
    pdfAndCheck(ctx, await require('./uat.js').build());
  },
};
