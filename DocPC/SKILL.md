---
name: docpc
description: Document Pipeline Compose (DocPC). Builds graded assignment documents (proposals, reports, meeting minutes and progress sheets, filled forms) from source files - text scripts, draw.io diagrams, Word assembly with the lecturer's cover, and checks. Use when the user asks to write, build or rebuild assignment documentation, or types /docpc.
---

# Document Pipeline Compose (DocPC)

DocPC builds a document from source files: the text comes from a script, the diagrams are draw.io files, Microsoft Word
adds the cover, the figures and the contents lists, and a check step looks at the result. The documents can be rebuilt at any time.

In this file, `<skill>` is the folder that holds this file.

## Rules (read first)

- **Never invent facts.** Do not invent testers, marks, feedback, signatures, meeting facts or test results. If a fact is
  not known yet, write a note in brackets (`TODO(...)` in body.js) and tell the user.
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
2. **Make three folders there** (keep the folders that exist):
   - `Inputs/`: the files from the user. The skill only reads them.
   - `Source/`: the working files. Copy everything in `<skill>/templates/` into it, then run `npm install` in it.
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
7. **Run only the categories that this document needs** (next section).

## Categories

### 1. Write the text

- Write the text in `Source/body.js`. Follow the heading order of the lecturer's template.
- Helpers: `H1`, `H2`, `H3`, `P` (`**bold**`, `*italic*`), `bullets`, `numbered`, `table`, `figure`, `caption`, `ref`, `TODO`, `FRONT` (front headings).
- Placeholders: `[[COVER]]`, `[[TOC]]`, `[[LOF]]`, `[[LOT]]` and `[[FIG:key]]` (key = a file name in `Source/figures/`). `assemble.ps1` replaces them.
- Figure and table numbers: list every key in `FIGURES` and `TABLES` in document order. Use `fig('key')` and `tab('key')` in the text. The build stops if the order is wrong, so the numbers in the text are always correct.
- Run `node body.js`. Then run category 3.

### 2. Draw diagrams

- Every diagram is a draw.io file in `Source/drawio/`. These files are the source: the user can edit them in draw.io (desktop or app.diagrams.net).
- Design diagrams (context diagram, DFDs, ERD):
  - By default, draw only the context diagram, the DFD Level 0 and the ERD. Draw Level 1 or Level 2 DFDs only when the user asks for them (or the brief or rubric requires them).
  - Write them in `Source/design.json` (the format is in the header of `design.js`). Replace the example entries.
    - `context`: the system (process 0) and its entities, with the flows.
    - `dfd`: entities on the left (and right), processes in the middle, data stores on the right. Use the same type for Level 0, 1 and 2 (for example `dfd0`, `dfd1_2`, `dfd2_2_3`).
    - `erd`: Crow's Foot notation. Each entity is a table on a grid (column, row); an attribute is `name`, `PK name`, `FK name` or `PK,FK name`. A relation has a verb and the cardinality at each end: `1`, `0..1`, `1..*` or `0..*`.
  - Run `node design.js`. It writes native draw.io shapes straight to `drawio/<name>.drawio`, only if the file does not exist.
  - Every arrow head and line end must touch its shape, with no gap. `design.js` computes the ends on the real outline of each shape. If it prints `WARNING ... runs through ...`, a line crosses another shape: move a shape and run it again.
  - The layout is a first draft. Look at the export. If lines cross or labels overlap, give an item its own `y` (or move the entity on the grid), move the old file to a backup folder and run again. Or tell the user to move the shapes in draw.io.
  - Every flow and relation must come from the design of the system (the brief, the user's notes or the code). Do not invent data stores or flows.
- To make another diagram:
  1. Add a function to `Source/diagrams.js` that draws a simple SVG (helpers `box`, `line`, `plain`, `text`). The Gantt chart reads `plan.json`.
  2. Run `node diagrams.js`. It writes `gen/*.svg`.
  3. Run `node svg2drawio.js gen/*.svg`. It makes `drawio/<name>.drawio` only if the file does not exist.
- To export: run `node drawio-svg.js` (all) or `node drawio-svg.js <name>`. It writes `figures/<name>.svg` with the draw.io viewer in headless Microsoft Edge (needs internet for the viewer script).
- To regenerate a diagram that changed in code: move the old `.drawio` file to a backup folder first, then run `node design.js <name>` (design diagrams) or steps 2 and 3 (other diagrams). Do not use `--reset`: it overwrites the user's draw.io edits.
- If a flowchart changes, change its text description (for example Structured English) in the same step.
- Then run category 4 on the exported SVGs (look at them).

### 3. Assemble the document

- Close the output file in Word first.
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File assemble.ps1` in `Source/`. It:
  1. copies the cover (everything before `coverEnd`) from the lecturer's template, with the template's own formatting;
  2. fills the cover from `coverAfter`, `coverReplace` and `coverTables` in `doc.json`;
  3. puts each figure at its `[[FIG:key]]` (never enlarged: it only shrinks a picture that is too large);
  4. builds the contents, the list of figures and the list of tables;
  5. saves `Outputs/<output>.docx` and `.pdf`.
- If it reports "cover label not found" or "cover table not found", fix `doc.json`. If the cover has floating tables or form fields that do not fill, change `assemble.ps1` for this template.
- Then run category 4.

### 4. Check

- Run `powershell -NoProfile -ExecutionPolicy Bypass -File <skill>/checks/check.ps1 -Pdf <file.pdf>`. It reports the page count, landscape pages, placeholders left, broken Word fields (`Error! ...`), notes in brackets and figure captions at the top of a page. Add `-AllowLandscape` for minutes and progress sheets.
- For design diagrams, run `node <skill>/checks/touch.js figures/<name>.svg ...` after the export. It reports every line end that is not on a shape border (exit code = the number of bad ends). Fix each one before assembly; a user who edits a `.drawio` file can also leave a gap.
- Render pages and look at them: `powershell -NoProfile -ExecutionPolicy Bypass -File <skill>/checks/render.ps1 -Pdf <file.pdf> -Out <prefix> -Pages "1,5"`. Look at the cover, the contents and every page with a figure or a table.
- Check that the cover is complete, no caption is cut from its picture, the pages are portrait (unless the form is landscape) and no screenshot is larger than its original size.
- Run the PDF scripts with `powershell -File` (a separate process). In a shell that stays open, the PDF engine keeps the PDF locked, and Word then cannot replace it.

### 5. Forms and records

- **Meeting minutes and progress sheets** (the built-in form: coloured bars, 5 parts; progress sheet on one landscape
  page). If the project's `Inputs/` has a sample of these forms, change the layout in `minutes.js` to match it.
  1. Write `Source/minutes.json`: one item per page, in order.
  2. Run `node minutes.js`. It writes `Outputs/<output>.docx`.
  3. Run `powershell -NoProfile -ExecutionPolicy Bypass -File pdf.ps1 ../Outputs/<output>.docx`.
  4. If the report shows the forms as images: render the pages with `render.ps1`, then trim them with `<skill>/checks/crop.ps1 <source.png> <result.png>`. Put the images in `Source/figures/` and use `figure()` in body.js.
  - Write only real meeting facts. If the user lets the model choose meeting dates, times or places, record that in the project context file.
- **Excel forms** (for example a workload matrix): write `Source/xlsx.json` (template, cells, optional signature), then run `powershell -NoProfile -ExecutionPolicy Bypass -File xlsx-fill.ps1`. To show the form in the report, take a picture of the filled area and put it in `Source/figures/`.
- **Other forms** (for example a test script or a feedback form for users): write a small `docx` script like `minutes.js`.

### 6. Evidence from a system (only if the project has a built app)

- Screenshots: capture each screen of the running app (for example with headless Edge or a browser tool) into `Source/figures/`. Keep their original size.
- Test results: save them as JSON in `Source/` and make `body.js` read the JSON, so the report shows the real results.
- If the tests change data (accounts, passwords), restore the data after the tests.

### 7. Context and safety

- After each work session, write the state and the decisions into the project context file (for example `CLAUDE.md`, `AGENTS.md` or a notes file): what is built, what is open, which facts the user gave.
- Keep the source of truth clear: the text is in `body.js`, the diagrams are in `drawio/`, the plan is in `plan.json`.

## Writing rules

- Use the writing style in `local/setup.md`. If the user's profile has writing-style files, follow them.
- If not, use ASD-STE100 Simplified Technical English: short sentences (at most 20 words for an instruction, 25 for a description), active voice, simple tenses, one meaning for each word.
- Follow the heading order and the numbering of the lecturer's template.
- Use team wording (for example "the project team", never "I") only when the user asks for it. If not, use the voice that the brief or the template asks for, or a neutral, impersonal style.
- Keep all pages portrait unless a form must be landscape.

## Known problems

- **Word hangs on save without an error:** a path made with PowerShell `Join-Path` makes Word `SaveAs2` hang. Give Office plain strings (`[IO.Path]::Combine`, `[string]$path`). The templates already do this.
- **A long Gantt label overlaps its bar:** keep the `g` labels and the group names in `plan.json` short (about 30 characters).
- **The draw.io export prints "no SVG from the viewer":** check the internet connection and run `drawio-svg.js` again for that file.

## Requirements

- Windows with Microsoft Word and Microsoft Excel (the assembly and the forms drive them from PowerShell through COM).
  - The setup records the platform. Check it again at the start. If the user has no Word or Excel, or uses macOS or Linux, tell the user before you plan. Only these steps work: text, minutes, diagrams, the diagram export (with Chrome or Chromium in `EDGE`) and `touch.js`.
  - Then give the user the manual steps in the "Without Word or Excel" part of `README.md` for the assembly, the PDF and the Excel forms.
- Node.js 18 or later, with the `docx` package (`npm install` in `Source/`).
- Microsoft Edge (for the draw.io export). Set the `EDGE` environment variable if Edge is not in the default place.
- Optional: `pdftotext` (Poppler; Git for Windows includes it) for the text checks.
