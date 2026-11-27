// Where a pipeline step reads and writes. run.js sets DOCPC_SOURCE to the document's Source/ folder; a step that is
// started by hand uses the folder it runs in. Outputs/ is the sibling of Source/.
const fs = require('fs'), path = require('path');

const SOURCE = path.resolve(process.env.DOCPC_SOURCE || process.cwd());
const OUTPUTS = path.join(SOURCE, '..', 'Outputs');
const src = (...parts) => path.join(SOURCE, ...parts);

// A data file of the document, with a clear error if it is missing.
function readJson(name) {
  const file = src(name);
  if (!fs.existsSync(file)) throw new Error(`${file} is missing. Run "node <skill>/run.js init" to copy the example.`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { SOURCE, OUTPUTS, src, readJson };
