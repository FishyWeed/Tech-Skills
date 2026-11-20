# Tech Skills

AI skills that work with Claude Code and other AI agents. Each skill is one folder in this repository, with its own
`README.md`, setup guide and MIT license. The instructions are plain Markdown and every step is a normal script, so
any agent that can read files and run shell commands can use them.

| Skill | What it does | Platform |
| --- | --- | --- |
| [DocPC](../DocPC/) | Builds assignment documents (proposals, reports, meeting minutes, filled forms) from source files | Windows with Word and Excel (some steps work anywhere) |
| [CTX-PLINE](../CTX-PLINE/) | Session memory for software projects, for any model in any tool | Any system with Python 3 |

## Get the skills

```bash
git clone https://github.com/FishyWeed/Tech-Skills.git
```

Then copy the folder of the skill that you want to where your tool finds skills. Each skill's own section below and
its `SETUP.md` give the exact place.

---

## DocPC (Document Pipeline Composer)

DocPC builds graded assignment documents from source files. The text comes from a script, the diagrams are draw.io
files, Microsoft Word adds the lecturer's cover, the figures and the contents lists, and a check step looks at every
build. Because everything comes from source files, you can rebuild a document at any time.

### What it makes

- Proposals and reports, with a cover from the lecturer's template, a table of contents and lists of figures and tables.
- Design diagrams as editable draw.io files: a context diagram, DFDs and a Crow's Foot ERD. By default, it draws only
  the context diagram, the DFD Level 0 and the ERD.
- Other diagrams, such as a Gantt chart from the project plan.
- Meeting minutes and progress sheets.
- Filled Excel forms, such as a workload matrix.
- Evidence from a built app: screenshots and test results, if the project has an app.

### How it works

1. **Setup (once).** The skill checks your computer and asks you to choose:
   - **Clean slate:** generic defaults, and you give no files.
   - **University:** you give a sample of your university's usual documents. The skill finds the parts that all of
     them share (cover fields, page format, headings, citation style, logo) and records them.
2. **Folders.** For each document, the skill makes three folders:
   - `Inputs/`: the brief, the rubric, the lecturer's template and your notes. The skill only reads them.
   - `Source/`: the working files (text script, project plan, diagrams, figures).
   - `Outputs/`: only the finished `.docx`, `.pdf` and `.xlsx` files to hand in.
3. **Plan.** The skill reads `Inputs/` and makes a plan and a section list. It shows them to you before it writes.
4. **Build.** It runs only the steps that the document needs: text, diagrams, Word assembly, forms and evidence.
5. **Check.** It reports the page count, placeholders left, broken Word fields, notes in brackets and captions cut
   from their pictures. It also checks that every arrow head and line end in a diagram touches its shape. Then it
   renders pages to images and looks at them.

### Rules it keeps

- It never invents facts such as test results, testers, marks, signatures or meeting facts. It marks an unknown fact
  with a note in brackets and tells you.
- It never changes the files in `Inputs/`, and it backs up a file before it overwrites it.
- It uses your signature only when you allow it for that form.
- It keeps your details, logo and signature in its `local/` folder. Git ignores that folder, so they stay on your
  computer.

### What you need

> **Windows only, for now.** DocPC works fully only on Windows with the desktop versions of Microsoft Word and
> Microsoft Excel. The assembly, the PDF export, the Excel forms and the PDF checks control Word and Excel through
> COM, and COM exists only on Windows.

- Windows with Microsoft Word and Microsoft Excel (desktop versions).
- Node.js 18 or later.
- Microsoft Edge, and internet access for the draw.io viewer (diagram export).
- Optional: `pdftotext` for the text checks (Git for Windows includes it).

On macOS or Linux, or without Word or Excel, the text, the minutes, the diagrams and the line-end check work. You do
the assembly, the PDF export and the Excel forms by hand. The DocPC `README.md` gives the manual steps.

### Install

- **Claude Code:** copy the `DocPC` folder to `~/.claude/skills/docpc` (or `.claude/skills/docpc` in a project).
  Then type `/docpc`, or ask Claude to write your assignment documentation.
- **Other agents** (Codex, Gemini CLI, Cursor and others): tell the agent to read `AGENTS.md` or `SKILL.md` in the
  `DocPC` folder.

Read more: [DocPC/README.md](../DocPC/README.md) · [DocPC/SETUP.md](../DocPC/SETUP.md)

---

## CTX-PLINE (Context Pipeline)

CTX-PLINE gives a software project a memory that lasts across sessions, models and tools. The memory lives in the
project as plain files, so it travels with the code. One Python script reads and writes it. Any model that can run a
shell command can use it.

### What it keeps

| Kind | ID | Example |
| --- | --- | --- |
| Decision | `D-1` | A choice for the project, with the reason |
| Fact | `F-1` | Something that a session checked |
| Task | `T-1` | Open work |
| Issue | `I-1` | A known problem |
| Session | `s0001` | A short summary of one session |

The model treats open decisions and facts as project rules, unless you override them.

### The workflow

| Step | When | Command |
| --- | --- | --- |
| 0. Set up | Once, when you ask | `python <skill>/engine/ctx.py init` |
| 1. Start | Start of a session | `load --slim`: open tasks and issues, the newest decisions and facts, the last two sessions |
| 2. Recall | Before each new task | `recall <task words>`: only the decisions and facts that match the task |
| 3. Look up | When the model needs an old item | `find <words>`, `show <ID>`, `status` |
| 4. Save | End of a session or a milestone | `next`, then `save`: a short entry with new items |

With hooks, the tool runs steps 1 and 2 for the model, and a session that ends without a save still gets an
automatic entry. You only ask the model to save near the end of a session (in Claude Code: `/save`).

### Why it is small

- One file, `engine/ctx.py`: Python 3 standard library only, with no install step.
- No network and no model calls from the script.
- The start view is short, and `recall` adds only the items that match each task, so the memory costs few tokens.

### Supported tools

| Tool | Setup command | Hooks |
| --- | --- | --- |
| Claude Code | `init --claude` | Start, recall and end hooks, plus a `/save` command |
| Gemini CLI, Antigravity | `init --hooks gemini` | Start, recall and end hooks |
| OpenAI Codex | `init --instructions AGENTS.md` | Start and recall hooks, set by hand |
| Cursor, Windsurf, Aider, local models | `init --instructions AGENTS.md` | No hooks: a rule block in `AGENTS.md` tells the model the steps |

The Claude Code hooks run in daily use. The Gemini CLI and Codex hooks are not tested inside those tools yet.

### Install

1. Copy the `CTX-PLINE` folder to `~/.claude/skills/ctx-pline/` (Claude Code) or to any folder for another tool.
   Name the copy `ctx-pline`, to match the `name` in `SKILL.md`.
2. Run the tests from the skill folder: `python -m unittest discover -s tests`.
3. From the root folder of your project, run the setup command for your tool (table above).
4. Commit the memory folder (for example `.ctx/` or `.claude/context/`) with the project.

Read more: [CTX-PLINE/README.md](../CTX-PLINE/README.md) · [CTX-PLINE/SETUP.md](../CTX-PLINE/SETUP.md)

---

## License

Each skill has its own MIT license in its folder: [DocPC/LICENSE](../DocPC/LICENSE) and
[CTX-PLINE/LICENSE](../CTX-PLINE/LICENSE).
