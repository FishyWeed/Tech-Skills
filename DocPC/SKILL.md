---
name: docpc
description: Document Pipeline Composer (DocPC). Builds graded assignment documents (proposals, reports, meeting minutes and progress sheets, filled forms) from source files - text scripts, draw.io diagrams, Word assembly with the lecturer's cover, and checks. Use when the user asks to write, build or rebuild assignment documentation, or types /docpc.
---

# Document Pipeline Composer (DocPC)

DocPC builds a document from source files: the text comes from a script, the diagrams are draw.io files, Microsoft Word
adds the cover, the figures and the contents lists, and a check step looks at the result. The documents can be rebuilt at any time.

In this file, `<skill>` is the folder that holds this file.

## Rules (read first)

- **Never invent facts.** Do not invent testers, marks, feedback, signatures, meeting facts or test results. If a fact is
  not known yet, write a note in brackets (`TODO(...)` in content.js) and tell the user.
- **Never change or delete the files in `Inputs/`.** They are the user's and the lecturer's files.
- **Never rebuild a document that the user submitted or edited by hand**, unless the user tells you to. A rebuild
  overwrites the hand edits. Back up a file before you overwrite it.
- **Use the signature (the file that `<skill>/local/setup.md` names) only when the user allows it for that form.** Use
  the files in `<skill>/local/assets/` only when the user asks or the setup says that the document needs them.
- **`<skill>/local/` holds only the user's details and the university's common assets** (logo, signature). Never copy
  the files or facts of one module or project into it. They stay in that project's `Inputs/` and `Source/` folders.
- **Word and Excel safety:**
  - Work on a copy (the scripts do).
  - Stop only hidden `WINWORD.EXE` or `EXCEL.EXE` processes (no window title). A process with a window title is the user's.
  - Do not update all fields in Word: that resets form fields in a cover. Update only the contents and the lists (`assemble.ps1` does).
- **Do not read `<skill>/dev/` when you use the skill.** It is for the development of the skill only.

## Start

Do these steps in this order when the skill starts.

0. **Read `<skill>/local/setup.md`.** If it does not exist, follow `<skill>/SETUP.md` first. The setup records the
   platform, where the user's details come from, the writing style, the assets and (for a university) the usual
   components of its documents.
1. **Ask where to write the documentation.** Give two choices:
   - a new folder (ask for its name and place);
   - the folder that this chat runs in.
2. **Make three folders there:** run `node <skill>/run.js init <folder> <pipeline ...>` with the pipelines that the
   document needs (see "Pipelines"; no names = all). It keeps the folders and files that exist.
   - `Inputs/`: the files from the user. The skill only reads them.
   - `Source/`: the document's own data: the example data files of the chosen pipelines, to replace. The code stays
     in the skill, so a fix to the skill reaches every document.
   - `Outputs/`: only the finished files (`.docx`, `.pdf`, `.xlsx`).
3. **Ask the user to put the files in `Inputs/`:** the assignment brief, the rubric, the lecturer's template, samples and any notes. Wait until the user says that the files are in.
4. **Get the user's details** (name, student ID, email, university, programme, intake) from the source in `local/setup.md`:
   - A profile folder: read its `about-me.md` (or the file that holds the details), and the writing-style files that the setup names.
   - `local/me.md`: read it.
   - Chat: ask the user for the details, as bullet points, or for a `.md` file that holds them.
5. **Read every file in `Inputs/`.** Find the required sections and their order, the marking points, the minimum counts (pages, words, diagrams, meetings), the cover and the deadline.
6. **Plan:**
   - Fill `Source/doc.json` (title, header, footer, template, cover values). If `local/setup.md` has a university
     part, use its page format, header, footer and cover fields where the brief does not say otherwise.
   - Write `Source/plan.json` (the project plan) from the brief. Do not copy the plan of another document.
   - List the sections in the order of the lecturer's template. Show the list and the plan to the user before you write the text.
7. **Run only the pipelines that this document needs** (next section).

## Pipelines

Each feature is a pipeline in `<skill>/pipelines/<name>/`. One command runs all of its steps in order and ends with its
check. Run it in the document folder (the folder that holds `Source/`), or give `--source <Source folder>`:

```
node <skill>/run.js                         list the pipelines, their data files and what they need
node <skill>/run.js <pipeline> [...]        run one or more pipelines in order
```

| Pipeline | Data in `Source/` | Result |
| --- | --- | --- |
| `text` | `content.js`, `doc.json` | `body.docx` (the body, with placeholders) |
| `pseudocode` | `pseudo/<key>.txt` | a check of the blocks; the text pipeline prints the files |
| `design` | `design.json` | context diagram, DFDs and ERD: `drawio/`, `figures/`, line-end check |
| `charts` | `charts.json`, `plan.json` | Gantt and hierarchy charts: `drawio/`, `figures/` |
| `wireframes` | `wireframe.json` | low-fidelity screens: `drawio/`, `figures/` |
| `screenshots` | `screens.json` | `figures/<name>.png` from the running app |
| `test` | `tests.json` | test counts, `tests-auto.json` from reports, the UAT pack in `Outputs/` |
| `minutes` | `minutes.json` | minutes and progress sheets in `Outputs/` (and page images if asked) |
| `excel` | `xlsx.json` | a filled Excel form in `Outputs/` |
| `assemble` | `content.js`, `doc.json`, `figures/` | the full document in `Outputs/` (runs `text` first), then the check |
| `check` | a PDF | the PDF check and page images in `render/` |

A run ends with `problems: <n>` and exit code 1 if a check found problems. Read every problem line, fix the cause and
run the pipeline again.

### text: write the text

- Write the content in `Source/content.js`. Follow the heading order of the lecturer's template. The header of the
  example lists every helper: `H1`, `H2`, `H3`, `P` (`**bold**`, `*italic*`), `bullets`, `numbered`, `table`, `figure`,
  `caption`, `ref`, `TODO`, `FRONT` (front headings), `HOLD` (placeholders), `pseudo`, `planRows` and `tests`.
- Placeholders: `[[COVER]]`, `[[TOC]]`, `[[LOF]]`, `[[LOT]]` and `[[FIG:key]]` (key = a file name in `Source/figures/`).
  The assemble pipeline replaces them.
- Figure and table numbers: list every key in `figures` and `tables` of `content.js` in document order. Use `fig('key')`
  and `tab('key')` in the text. The build stops if the order is wrong, so the numbers in the text are always correct.
- Run `text` for a quick build of `body.docx`, and `assemble` for the full document.

### pseudocode: write pseudocode

- Write each algorithm in `Source/pseudo/<key>.txt`, and put `...pseudo('<key>', 'caption')` in `content.js` (list the
  key in `figures`). Indent with spaces.
- Use capital keywords (`BEGIN`, `IF ... THEN`, `ELSE`, `END IF`, `WHILE`, `FOR`, `NEXT`, `REPEAT ... UNTIL`, `CASE`,
  `READ`, `DISPLAY`, `SET`, `RETURN`). The text pipeline prints them in bold.
- Run `pseudocode`. It checks that each block closes at the indent of its opener, that `ELSE` is inside an `IF` and that
  each `IF` ends with `THEN`.
- Write the pseudocode from the real code or the design, never from a guess. Change it in the same step as its flowchart.

### design, charts and wireframes: draw diagrams

- Every diagram is a draw.io file in `Source/drawio/`. These files are the source: the user can edit them in draw.io
  (desktop or app.diagrams.net). A pipeline creates a `.drawio` file only if it does not exist, and exports every file
  again, so the user's edits reach the report. Do not use `--reset`: it overwrites the user's draw.io edits. To
  regenerate one diagram, move its old `.drawio` file to a backup folder first.
- **design** (context diagram, DFDs, Crow's Foot ERD), from `design.json` (the format is in the header of `design.js`):
  - By default, draw only the context diagram, the DFD Level 0 and the ERD. Draw Level 1 or Level 2 DFDs only when the
    user asks for them (or the brief or rubric requires them).
  - `context`: the system (process 0) and its entities, with the flows. `dfd`: entities on the left (and right),
    processes in the middle, data stores on the right (for example `dfd0`, `dfd1_2`). `erd`: each entity is a table on
    a grid (column, row); an attribute is `name`, `PK name`, `FK name` or `PK,FK name`; a relation has a verb and the
    cardinality at each end: `1`, `0..1`, `1..*` or `0..*`.
  - Every arrow head and line end must touch its shape, with no gap. The pipeline checks each line end after the
    export. If it prints `WARNING ... runs through ...`, a line crosses another shape: move a shape and run it again.
  - The layout is a first draft. Look at the figures. If lines cross or labels overlap, give an item its own `y` (or
    move the entity on the grid), move the old `.drawio` file to a backup folder and run again. Or tell the user to move
    the shapes in draw.io.
- **charts**, from `charts.json` (types in the header of `charts.js`): the Gantt chart reads `plan.json`; a hierarchy
  chart has a root, modules and functions. To add a chart type, add a function to `charts.js` (helpers in `lib/svg.js`).
- **wireframes**, from `wireframe.json` (the element types are in the header of `wireframe.js`): a screen has a
  `desktop` or `mobile` frame, and each row is one element or a list of elements side by side. If the app exists,
  compare each wireframe with its screenshot.
- Every flow, relation, screen and element must come from the design of the system (the brief, the user's notes, the
  code or the app). Do not invent them.
- The export needs internet access for the draw.io viewer. Look at the exported figures.

### screenshots: evidence from a built app

- Write each page of the running app in `Source/screens.json` (name, address, and the size if it is not the default).
  Start the app first. Run `screenshots`. Each page becomes `figures/<name>.png` at the exact size.
- A page behind a login: capture it with a browser tool that the user signs in to, and save it in `figures/`. Never
  type a password for the user.

### test: test cases, results and the UAT pack

- **Never invent a result, a tester, a date or a signature.** Keep `actual`, `status`, `tester` and `date` empty until
  a real test run fills them in. An empty result prints `[not run]`, and the check reports it as a note.
- **Test cases:** write them in `tests.json` from the requirements and the design (ID, module, role, title, the
  condition before the test, steps, test data, expected result). Each role must be in `roles`.
- **Report tables:** in `content.js`, use `tests.caseRows()` (the test plan), `tests.resultRows()` (the results) and
  `tests.summaryRows()` (pass, fail, blocked and not run for each module) with `table()`. The example header shows the columns.
- **Real results:** when the user or a tester runs a test, write `actual`, `status` (`Pass`, `Fail` or `Blocked`),
  `tester` and `date` from that run. A status needs an actual result: the build stops if it has none.
- **Automated tests** (if the project has them): run the project's own tests with a report (for example
  `pytest --junitxml=report.xml`, `jest --json --outputFile=report.json`, or any tool with a JUnit XML reporter), put
  the report path in `reports` of `tests.json`, and run `test`. It writes `tests-auto.json`. In `content.js`, use
  `tests.autoSummaryRows()` (each suite) and `tests.autoFailRows()` (the failed tests).
- **UAT pack** (user acceptance testing): with `"uat": true`, the pipeline builds `Outputs/<output>.docx` and `.pdf`: a
  test script for each role, with empty Pass and Fail boxes and comments, and a feedback form (`feedback`: `scale` for
  1 to 5 boxes, `text` for an open box). The testers fill it in by hand. Then copy their real results into `tests.json`.
- If the tests change data (accounts, passwords), restore the data after the tests.
- After a change to the test or pseudocode scripts, run `node <skill>/pipelines/test/import.js --self-test` and
  `node <skill>/pipelines/pseudocode/pseudo.js --self-test`.

### minutes and excel: forms and records

- **minutes** (the built-in form: coloured bars, 5 parts; progress sheet on one landscape page), from `minutes.json`:
  one item per page, in order. If the project's `Inputs/` has a sample of these forms, change the layout in
  `minutes.js` to match it. With `"images": true`, each page also becomes `figures/<output>-<page>.png` for `figure()`.
  - Write only real meeting facts. If the user lets the model choose meeting dates, times or places, record that in
    the project context file.
- **excel** (for example a workload matrix), from `xlsx.json` (template, cells, optional signature). To show the form
  in the report, take a picture of the filled area and put it in `Source/figures/`.
- **Other forms** (for example a declaration): write a small script like `minutes.js`, with the parts in `lib/form-docx.js`.

### assemble: the full document

- Close the output file in Word first. Run the diagram, screenshot and minutes pipelines first, so that every
  `[[FIG:key]]` has its file in `figures/`.
- Run `assemble`. It builds the text, then in Word:
  1. copies the cover (everything before `coverEnd`) from the lecturer's template, with the template's own formatting;
  2. fills the cover from `coverAfter`, `coverReplace` and `coverTables` in `doc.json`;
  3. puts each figure at its `[[FIG:key]]` (never enlarged: it only shrinks a picture that is too large);
  4. builds the contents, the list of figures and the list of tables;
  5. reports a caption that is on another page than its figure or table;
  6. saves `Outputs/<output>.docx` and `.pdf`, and checks the PDF.
- If it reports "cover label not found" or "cover table not found", fix `doc.json`. If the cover has floating tables or
  form fields that do not fill, change `assemble.ps1` for this template.

### check: look at the result

- `assemble`, `minutes` and `test` check their PDFs: page count, landscape pages, placeholders left, broken Word fields
  (`Error! ...`) and notes in brackets.
- Render pages and look at them: `node <skill>/run.js check Outputs/<file>.pdf --pages "1,5"` (add `--landscape` for
  minutes and progress sheets). The images go to `Source/render/`. Look at the cover, the contents and every page with
  a figure or a table.
- Check that the cover is complete, the pages are portrait (unless the form is landscape) and no screenshot is larger
  than its original size.

## Context and safety

- After each work session, write the state and the decisions into the project context file (for example `CLAUDE.md`,
  `AGENTS.md` or a notes file): what is built, what is open, which facts the user gave.
- Keep the source of truth clear: the text is in `content.js`, the diagrams are in `drawio/`, the plan is in `plan.json`,
  the tests are in `tests.json`.

## Writing rules

- Use the writing style in `local/setup.md`. If the user's profile has writing-style files, follow them.
- If not, use ASD-STE100 Simplified Technical English: short sentences (at most 20 words for an instruction, 25 for a description), active voice, simple tenses, one meaning for each word.
- Follow the heading order and the numbering of the lecturer's template.
- Use team wording (for example "the project team", never "I") only when the user asks for it. If not, use the voice that the brief or the template asks for, or a neutral, impersonal style.
- Keep all pages portrait unless a form must be landscape.

## Known problems

- **Word hangs on save without an error:** a path made with PowerShell `Join-Path` makes Word `SaveAs2` hang. Give Office plain strings (`[IO.Path]::Combine`, `[string]$path`). The scripts already do this.
- **A long Gantt label overlaps its bar:** keep the `g` labels and the group names in `plan.json` short (about 30 characters).
- **The draw.io export prints "no SVG from the viewer":** check the internet connection and run the pipeline again.
- **Run the PDF scripts in a separate process** (`run.js` does). In a shell that stays open, the PDF engine keeps the PDF
  locked, and Word then cannot replace it.

## Requirements

- Windows with Microsoft Word and Microsoft Excel (the assembly and the forms drive them from PowerShell through COM).
  - The setup records the platform. Check it again at the start. If the user has no Word or Excel, or uses macOS or Linux, tell the user before you plan. Only these pipelines work: `text`, `pseudocode`, `design`, `charts` and `wireframes` (the export with Chrome or Chromium in `EDGE`), and the `.docx` part of `minutes` and `test`.
  - Then give the user the manual steps in the "Without Word or Excel" part of `README.md` for the assembly, the PDF and the Excel forms.
- Node.js 18 or later, with the `docx` package: run `npm install` once in `<skill>` (the setup does).
- Microsoft Edge (for the draw.io export and the screenshots). Set the `EDGE` environment variable if Edge is not in the default place.
- Optional: `pdftotext` (Poppler; Git for Windows includes it) for the text checks.
