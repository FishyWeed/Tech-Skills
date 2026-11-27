// Pseudocode pipeline: checks the block structure of every pseudo/<key>.txt (BEGIN/END, IF/ELSE/END IF, WHILE,
// FOR/NEXT, REPEAT/UNTIL, CASE, FUNCTION, PROCEDURE and their indents). The text pipeline prints the files.
// Usage: node <skill>/run.js pseudocode
const { checkAll, keys } = require('./pseudo.js');

module.exports = {
  description: 'Check the pseudocode files in pseudo/ (blocks closed, IF with THEN, indents); the text pipeline prints them',
  data: ['pseudo'],
  run(ctx) {
    if (!keys().length) throw new Error('pseudo/ has no .txt files');
    ctx.problems += checkAll();
  },
};
