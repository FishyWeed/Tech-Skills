// Pseudocode files (pseudo/<key>.txt): the keywords, the reader and a check of the block structure.
// The text pipeline prints a file with pseudo('<key>', 'caption'); the pseudocode pipeline checks every file.
// Usage by hand: node pseudo.js [--self-test]   (in Source/: checks every pseudo/*.txt)
const fs = require('fs'), assert = require('assert');
const { src } = require('../../lib/paths.js');

// Whole words in capitals from this list are printed in bold.
const KEYWORDS = new Set(('BEGIN END IF THEN ELSE ENDIF WHILE ENDWHILE DO FOR EACH TO STEP NEXT ENDFOR REPEAT UNTIL CASE OF ' +
  'OTHERWISE ENDCASE FUNCTION PROCEDURE RETURN CALL READ INPUT GET DISPLAY OUTPUT PRINT SET AND OR NOT TRUE FALSE').split(' '));

// The lines of pseudo/<key>.txt, with tabs as 4 spaces and no empty lines at the end.
const read = key => fs.readFileSync(src('pseudo', `${key}.txt`), 'utf8').replace(/\t/g, '    ').replace(/\s+$/, '').split(/\r?\n/);
const keys = () => (fs.existsSync(src('pseudo')) ? fs.readdirSync(src('pseudo')).filter(f => f.endsWith('.txt')).map(f => f.slice(0, -4)) : []);

// Each block opener and the words that close it.
const BLOCKS = [
  ['BEGIN', /^END$/], ['IF', /^(END ?IF)\b/], ['WHILE', /^(END ?WHILE)\b/], ['FOR', /^(END ?FOR|NEXT)\b/],
  ['REPEAT', /^UNTIL\b/], ['CASE', /^(END ?CASE)\b/], ['FUNCTION', /^END FUNCTION\b/], ['PROCEDURE', /^END PROCEDURE\b/],
];

// Returns a list of problems: blocks that do not close, closers without an opener, ELSE outside an IF, an IF without
// THEN, and a closer or ELSE at another indent than its opener.
function check(lines) {
  const open = [], out = [];
  lines.forEach((raw, i) => {
    const t = raw.trim(), indent = raw.match(/^ */)[0].length, at = `line ${i + 1}`;
    if (!t) return;
    const closer = BLOCKS.find(([, end]) => end.test(t));
    if (closer) {
      const top = open.pop();
      if (!top) return out.push(`${at}: "${t}" closes no block`);
      if (top.word !== closer[0]) out.push(`${at}: "${t}" closes ${closer[0]}, but the open block is ${top.word} (line ${top.line})`);
      else if (top.indent !== indent) out.push(`${at}: "${t}" is not at the indent of its ${top.word} (line ${top.line})`);
      return;
    }
    if (/^ELSE\b/.test(t)) {
      const top = open.at(-1);
      if (!top || top.word !== 'IF') out.push(`${at}: ELSE is not inside an IF`);
      else if (top.indent !== indent) out.push(`${at}: ELSE is not at the indent of its IF (line ${top.line})`);
      return;
    }
    const opener = BLOCKS.find(([word]) => new RegExp(`^${word}\\b`).test(t));
    if (!opener) return;
    if (opener[0] === 'IF' && !/\bTHEN$/.test(t)) out.push(`${at}: IF has no THEN at the end`);
    open.push({ word: opener[0], indent, line: i + 1 });
  });
  for (const b of open) out.push(`line ${b.line}: ${b.word} is not closed`);
  return out;
}

// Checks every pseudo/*.txt file, prints the problems and returns their number.
function checkAll() {
  let problems = 0;
  for (const key of keys()) {
    const found = check(read(key));
    for (const p of found) console.log(`pseudo/${key}.txt ${p}`);
    console.log(`pseudo/${key}.txt: ${found.length ? `${found.length} problems` : 'blocks closed'}`);
    problems += found.length;
  }
  return problems;
}

function selfTest() {
  assert.deepStrictEqual(check(['BEGIN', '  IF a THEN', '    SET b = 1', '  ELSE', '    SET b = 2', '  END IF', 'END']), []);
  assert.deepStrictEqual(check(['FOR i = 1 TO 3', '  DISPLAY i', 'NEXT', 'REPEAT', '  READ x', 'UNTIL x > 0']), []);
  assert.deepStrictEqual(check(['BEGIN', '  IF a', '  END IF']), ['line 2: IF has no THEN at the end', 'line 1: BEGIN is not closed']);
  assert.deepStrictEqual(check(['WHILE a', '  ELSE', 'END IF']), ['line 2: ELSE is not inside an IF', 'line 3: "END IF" closes IF, but the open block is WHILE (line 1)']);
  assert.deepStrictEqual(check(['IF a THEN', '    END IF']), ['line 2: "END IF" is not at the indent of its IF (line 1)']);
  console.log('self-test passed');
}

module.exports = { KEYWORDS, read, keys, check, checkAll };
if (require.main === module) process.argv.includes('--self-test') ? selfTest() : (process.exitCode = checkAll());
