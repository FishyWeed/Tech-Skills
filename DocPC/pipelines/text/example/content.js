// The content of the document, for the text pipeline (node <skill>/run.js text). Replace this example content and
// follow the heading order of the lecturer's template.
//
// figures and tables: every figure and table key in document order. fig('key') and tab('key') give "Figure 1" or
// "Table 1", so the text can refer to a figure before or after it. The build stops if the caption order differs.
//
// Helpers: H1, H2, H3, P (**bold**, *italic*), FRONT (front headings), HOLD (placeholders), bullets, numbered,
// table, caption, gap, TODO (a note for a fact that is not known yet), ref, fig, tab, and from other pipelines:
//   ...figure('gantt', 'Gantt chart')                   figures/gantt.svg or .png (charts, design, wireframes, screenshots)
//   ...pseudo('login-pseudo', 'Pseudocode of the login') pseudo/login-pseudo.txt (pseudocode pipeline)
//   table(['ID', 'Task', 'Duration', 'Start', 'End', 'Status'], planRows(), [1.1, 3.2, 1, 1.2, 1.2, 1])   plan.json
//   table(['ID', 'Module', 'Test case', 'Steps', 'Test data', 'Expected result'], tests.caseRows(), [0.8, 1, 1.6, 2.6, 1.3, 1.7])
//   (tests.resultRows(), tests.summaryRows(), tests.autoSummaryRows() and tests.autoFailRows(): see the test pipeline)
module.exports = {
  figures: [],
  tables: ['example'],
  body: ({ HOLD, FRONT, H1, H2, P, bullets, numbered, caption, table, gap, TODO, ref, tab }) => [
    HOLD('COVER'),
    FRONT('TABLE OF CONTENTS'), HOLD('TOC'),
    // FRONT('LIST OF FIGURES'), HOLD('LOF'),   add it when the document has figures
    FRONT('LIST OF TABLES'), HOLD('LOT'),

    H1('1.0 Introduction'),
    P(`This paragraph is an example. ${tab('example')} shows an example table.`),
    ...bullets(['A bullet point with **bold** text.', 'A bullet point with *italic* text.']),
    TODO('Example note: add the results after the tests'),

    H2('1.1 Objectives'),
    ...numbered(['The first objective.', 'The second objective.']),
    caption('Table', 'example', 'An example table'),
    table(['Item', 'Description'], [['First', 'The first item.'], ['Second', 'The second item.']], [1, 3]),
    gap(),

    H1('References'),
    ref('Author, A. (2026) *Title of the source*. Publisher. Available at:', 'https://example.com'),
  ],
};
