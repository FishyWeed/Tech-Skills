# DocPC: Document Pipeline Composer

DocPC is an AI skill that builds graded assignment documents from source files: proposals, reports, meeting minutes,
progress sheets and filled forms. The text comes from a script, the diagrams are editable draw.io files, Microsoft Word
adds the lecturer's cover, the figures and the contents lists, and a check step looks at every build. Because
everything comes from source files, you can change one part and rebuild the whole document at any time.

> **Windows only, for now.** DocPC works fully only on Windows with the desktop versions of Microsoft Word and
> Microsoft Excel. On macOS or Linux, or without Word or Excel, only some steps work, and you do the rest by hand.
> See [What you need](#what-you-need). No workaround for the other steps is tested yet.

## What it makes

| Output | How |
| --- | --- |
| Proposals and reports | The text comes from a script. Word adds the cover from the lecturer's template, the figures, a table of contents and lists of figures and tables. The figure and table numbers in the text stay correct when you add or move a figure. |
| Design diagrams | A context diagram, DFDs and a Crow's Foot ERD, written as native draw.io files from one JSON file. By default, it draws only the context diagram, the DFD Level 0 and the ERD. |
| Other diagrams | A Gantt chart from the project plan, hierarchy charts and your own simple drawings, turned into draw.io files. |
| Wireframes | Low-fidelity screens (header, navigation, inputs, buttons, images, tables, lists, cards) in a desktop or mobile frame, from one JSON file, as editable draw.io files. |
| Pseudocode | A text file for each algorithm, shown in a grey box with the keywords in bold and a figure caption. |
| Testing | Test cases, test results and a summary by module from one JSON file. The results of the project's own automated tests (JUnit XML or Jest JSON). A UAT pack: a test script for each user role and a feedback form, for testers to fill in. |
| Meeting minutes and progress sheets | Word files from one JSON file, with one page for each meeting. |
| Excel forms | The cells of a template filled in, for example a workload matrix, with your signature if you allow it. |
| Evidence | Screenshots of the pages of a running app at the exact size, from one JSON file, if the project has an app. |

You can edit every diagram in draw.io (desktop or app.diagrams.net). The next build uses your edits.

Each output is its own pipeline. One command runs all of its steps and ends with its check, for example
`node run.js wireframes` or `node run.js assemble`. `node run.js` lists the pipelines.

## How it works

1. **Setup (first run only).** The skill runs its setup (`SETUP.md`). It checks your computer and asks you to choose:
   - **Clean slate:** generic defaults. You give no files.
   - **University:** you give a sample of your university's usual documents (a lecturer's template or a past
     document). The skill lists the parts that you must give, such as the logo, and records what all your
     university's documents share. A module's own template, cover and forms stay in that project's `Inputs/` folder.

   The setup writes `local/setup.md`, can keep your details in `local/me.md`, and keeps your logo and signature in
   `local/assets/`. Git ignores `local/`, so your details stay on your computer. To change the setup later, ask the
   skill to run the setup again.
2. **Folders.** For each document, the skill asks where to write it: in a new folder, or in the folder the chat runs
   in. It makes three folders there:
   - `Inputs/`: the brief, the rubric, the lecturer's template, samples and your notes. The skill only reads them.
   - `Source/`: the document's own data (content, project plan, diagram specs, draw.io files, figures). The code stays
     in the skill, so a fix to the skill reaches every document. You can rebuild everything from `Source/`.
   - `Outputs/`: only the finished `.docx`, `.pdf` and `.xlsx` files to hand in.
3. **Your details.** The skill reads them from the place that you chose in the setup: a profile folder (`about-me.md`),
   its own `local/me.md` file, or the chat.
4. **Plan.** The skill reads `Inputs/` and makes a project plan and a section list in the order of the lecturer's
   template. It shows them to you before it writes.
5. **Build.** It runs only the pipelines that the document needs: text, pseudocode, diagrams, charts, wireframes,
   screenshots, testing, forms and the Word assembly.
6. **Check.** It reports the page count, the placeholders left, broken Word fields, notes in brackets and captions on
   another page than their figure or table. It checks that every arrow head and line end in a diagram touches its
   shape. Then it renders the pages to images and looks at them.

## Rules the skill keeps

- It never invents facts such as test results, testers, marks, signatures or meeting facts. It marks an unknown fact
  with a note in brackets and tells you.
- It never changes the files in `Inputs/`, and it backs up a file before it overwrites it.
- It does not rebuild a document that you edited by hand, unless you tell it to.
- It uses your signature only when you allow it for that form.
- It keeps your setup, details, logo and signature in its `local/` folder. Git ignores that folder, so they stay on
  your computer.
- It writes in the style of your profile if you have one, and in ASD-STE100 Simplified Technical English if not.
- It uses team wording ("the project team") only when you ask for it.

## Install

- **Claude Code:** DocPC is one folder of a repository with several skills. Clone or download the repository, then copy
  its `DocPC` folder into your skills folder (`~/.claude/skills/docpc`, or `.claude/skills/docpc` in a project). Run
  `npm install` once in that folder. Then type `/docpc`, or ask Claude to write your assignment documentation. The
  first run starts the setup.
- **Other AI agents** (Codex, Gemini CLI, Cursor and others): tell the agent to read `AGENTS.md` or `SKILL.md` in this
  folder. The instructions are plain Markdown, and every step is a normal Node.js or PowerShell script.

## What you need

DocPC works fully only on **Windows with Microsoft Word and Microsoft Excel**. The assembly, the PDF export, the Excel
forms and the PDF checks are PowerShell scripts that control Word and Excel through COM, and COM exists only on Windows.

- Windows with Microsoft Word and Microsoft Excel (desktop versions, not the web versions).
- Node.js 18 or later.
- Microsoft Edge, and internet access for the draw.io viewer (diagram export).
- Optional: `pdftotext` for the text checks (Git for Windows includes it).

### Without Word or Excel, or on macOS or Linux

Some steps work anywhere, and some need Windows with Word or Excel:

| Pipeline | Works without Word or Excel, and on macOS or Linux? |
| --- | --- |
| `text` (writes `body.docx`), `pseudocode` | Yes (Node.js). |
| `design`, `charts`, `wireframes` | Yes (Node.js). The export should work with Google Chrome or Chromium instead of Edge: set the `EDGE` environment variable to its path. Not tested on macOS or Linux yet. |
| `minutes`, `test` | The `.docx` files: yes (Node.js). Their PDF and its check: no. |
| `screenshots` | No. It uses Edge and .NET on Windows. |
| `assemble`: cover, figures, contents lists, PDF | No. It needs Word on Windows. |
| `excel` | No. It needs Excel on Windows. |
| `check` | No. It uses the Windows PDF engine. |

If you cannot use Word, do these steps by hand:

1. Open `body.docx` in your word processor (LibreOffice Writer, or Word on macOS).
2. Paste the lecturer's cover over `[[COVER]]`, and put each `figures/<name>.svg` (or a PNG) at its `[[FIG:name]]`.
3. Insert the table of contents and the lists of figures and tables at `[[TOC]]`, `[[LOF]]` and `[[LOT]]`.
4. Export the PDF.

Fill the Excel forms by hand. Support for LibreOffice on macOS and Linux is a future feature.

## Folder layout

| Path | What it holds |
| --- | --- |
| `SKILL.md` | The steps and rules for the AI. |
| `AGENTS.md` | A pointer to `SKILL.md` for other AI agents. |
| `SETUP.md` | The first-run setup for the AI: clean slate or university. |
| `local/` | Made by the setup, and ignored by git: `setup.md` (your choices), `me.md` (your details, if you ask) and `assets/` (your signature and logo; no project files). The skill uses the assets only when you ask. |
| `run.js`, `package.json` | The runner of the pipelines, and the one package that they need (`docx`). |
| `pipelines/` | One folder for each pipeline: its scripts, its `pipeline.js` (the steps in order) and `example/` (the data files that `run.js init` copies into `Source/`). The pipelines are `text`, `pseudocode`, `design`, `charts`, `wireframes`, `screenshots`, `test`, `minutes`, `excel`, `assemble` and `check`. |
| `lib/` | The parts that the pipelines share: paths, SVG drawing, SVG to draw.io, the draw.io export, the project plan, XML text, Word form parts, the Word PDF export and the Windows PDF engine. |

## License

MIT. See `LICENSE`.
