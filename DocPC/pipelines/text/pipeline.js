// Text pipeline: content.js + doc.json -> body.docx (the body with placeholders for the cover, figures and lists).
// Usage: node <skill>/run.js text   (the assemble pipeline runs it first, so use this one alone for a quick build)
const { build } = require('./build.js');

module.exports = {
  description: 'The text of the document from content.js and doc.json, as body.docx (Node.js only)',
  data: ['doc.json', 'content.js'],
  run: () => build(),
};
