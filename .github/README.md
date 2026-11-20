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

DocPC is an AI skill that builds graded assignment documents from source files: proposals, reports, meeting minutes,
progress sheets and filled forms. The text comes from a script, the diagrams are editable draw.io files, Microsoft Word
adds the lecturer's cover, the figures and the contents lists, and a check step looks at every build. Because
everything comes from source files, you can change one part and rebuild the whole document at any time.

### What it makes

| Output | How |
| --- | --- |
| Proposals and reports | The text comes from a script. Word adds the cover from the lecturer's template, the figures, a table of contents and lists of figures and tables. The figure and table numbers in the text stay correct when you add or move a figure. |
| Design diagrams | A context diagram, DFDs and a Crow's Foot ERD, written as native draw.io files from one JSON file. By default, it draws only the context diagram, the DFD Level 0 and the ERD. |
| Other diagrams | A Gantt chart from the project plan, hierarchy charts and your own simple drawings, turned into draw.io files. |
| Meeting minutes and progress sheets | Word files from one JSON file, with one page for each meeting. |
| Excel forms | The cells of a template filled in, for example a workload matrix, with your signature if you allow it. |
| Evidence | Screenshots and test results from a built app, if the project has one. |

You can edit every diagram in draw.io (desktop or app.diagrams.net). The next build uses your edits.

### How it works

1. **Setup (first run only).** The skill checks your computer and asks you to choose:
   - **Clean slate:** generic defaults. You give no files.
   - **University:** you give a sample of your university's usual documents. The skill lists the parts that you must
     give, such as the logo, and records what all your university's documents share. A module's own template, cover
     and forms stay in that project's `Inputs/` folder.
2. **Folders.** For each document, the skill makes three folders:
   - `Inputs/`: the brief, the rubric, the lecturer's template and your notes. The skill only reads them.
   - `Source/`: the working files (text script, project plan, diagrams, figures). You can rebuild everything from them.
   - `Outputs/`: only the finished `.docx`, `.pdf` and `.xlsx` files to hand in.
3. **Your details.** The skill reads them from the place that you chose in the setup: a profile folder (`about-me.md`),
   its own `local/me.md` file, or the chat.
4. **Plan.** The skill reads `Inputs/` and makes a project plan and a section list in the order of the lecturer's
   template. It shows them to you before it writes.
5. **Build.** It runs only the steps that the document needs: text, diagrams, Word assembly, forms and evidence.
6. **Check.** It reports the page count, the placeholders left, broken Word fields, notes in brackets and captions
   cut from their pictures. It checks that every arrow head and line end in a diagram touches its shape. Then it
   renders the pages to images and looks at them.

### Rules it keeps

- It never invents facts such as test results, testers, marks, signatures or meeting facts. It marks an unknown fact
  with a note in brackets and tells you.
- It never changes the files in `Inputs/`, and it backs up a file before it overwrites it.
- It does not rebuild a document that you edited by hand, unless you tell it to.
- It uses your signature only when you allow it for that form.
- It keeps your setup, details, logo and signature in its `local/` folder. Git ignores that folder, so they stay on
  your computer.
- It writes in the style of your profile if you have one, and in ASD-STE100 Simplified Technical English if not.

### What you need

> **Windows only, for now.** DocPC works fully only on Windows with the desktop versions of Microsoft Word and
> Microsoft Excel. The assembly, the PDF export, the Excel forms and the PDF checks control Word and Excel through
> COM, and COM exists only on Windows. No workaround for other systems is tested yet.

- Windows with Microsoft Word and Microsoft Excel (desktop versions, not the web versions).
- Node.js 18 or later.
- Microsoft Edge, and internet access for the draw.io viewer (diagram export).
- Optional: `pdftotext` for the text checks (Git for Windows includes it).

On macOS or Linux, or without Word or Excel, the text, the minutes, the diagrams and the line-end check work. You do
the assembly, the PDF export and the Excel forms by hand. The DocPC `README.md` gives the manual steps.

### Install

- **Claude Code:** copy the `DocPC` folder to `~/.claude/skills/docpc` (or `.claude/skills/docpc` in a project). Then
  type `/docpc`, or ask Claude to write your assignment documentation. The first run starts the setup.
- **Other agents** (Codex, Gemini CLI, Cursor and others): tell the agent to read `AGENTS.md` in the `DocPC` folder.
  The instructions are plain Markdown, and every step is a normal Node.js or PowerShell script.

Read more: [DocPC/README.md](../DocPC/README.md) · [DocPC/SETUP.md](../DocPC/SETUP.md)

---

## CTX-PLINE (Context Pipeline)

CTX-PLINE gives a software project a memory that lasts across sessions, models and tools. A new session starts with
what earlier sessions decided and learned. You do not explain the project again, and the model does not search the
code again to find old decisions.

The memory lives in the project as plain files, so it travels with the code in git. One Python script reads and
writes it. Any model that can run a shell command can use it.

### What it keeps

| Kind | ID | Example |
| --- | --- | --- |
| Decision | `D-1` | A choice for the project, with the reason |
| Fact | `F-1` | Something that a session checked |
| Task | `T-1` | Open work |
| Issue | `I-1` | A known problem |
| Session | `s0001` | A short summary of one session |

The model treats open decisions and facts as project rules, unless you override them.

Each session adds one short entry of tagged lines (less than 4,000 characters). The script gives each new item a
stable ID. A later entry can close an item or replace a fact:

```markdown
Summary: Moved the deploy to Vercel.

D: Vercel is the deploy target, because the team deploys only from main
F: .npmrc has engine-strict=true, so installs fail on Node older than 22.17
T: Add the custom domain
X: T-4 done
F~2: The API port is 8081
```

### How it works

1. **Save.** Near the end of a session, the model writes the entry and runs `save`. The script checks the entry and
   writes one session file.
2. **Compile.** The script, with no model and no tokens, numbers the new items and compresses old sessions. The 2
   newest sessions stay in full, sessions 3 to 5 back keep only their main lines, and older session files are
   deleted. Every item stays in `ledger.json`, and an open item is never dropped.
3. **Start.** `load --slim` prints the open tasks and issues in full, the 30 newest decisions and facts as one line
   each, and the last two session summaries.
4. **Recall.** Before each task, `recall` prints only the open decisions and facts that match the task, at most 6.
   It ignores chat words, so a prompt such as "thanks, looks good" adds nothing.
5. **Look up.** `find <words>` searches every item ever recorded, open or closed. `show D-12` prints one item in full.
6. **End.** If a session ends without a save, the end hook writes a rough entry from the transcript. The next save
   replaces it.

With hooks, the tool runs steps 3, 4 and 6 for the model. You only ask the model to save near the end of a session
(in Claude Code: `/save`).

### What it costs

- In real Claude Code work sessions, the memory text was 0.1% to 0.9% of the session's token cost.
- In a small paid test on a web-app project (3 questions, 2 runs each), each question cost 29% less with the memory
  than without it. Only the runs with the memory answered one of the questions correctly.
- All file work (numbering, compression, search) runs in Python and uses no tokens.

These are small tests, so your results can be different. The methods and numbers are in
[reference/internals.md](../CTX-PLINE/reference/internals.md).

### Supported tools

| Tool | Setup command | What it adds | Tested |
| --- | --- | --- | --- |
| Claude Code | `init --claude` | Start, recall and end hooks, and a `/save` command | Yes, in daily use |
| Gemini CLI | `init --hooks gemini` | Start, recall and end hooks | Not yet inside Gemini CLI |
| OpenAI Codex | `init --instructions AGENTS.md` | A rule block in `AGENTS.md`; you add the hooks by hand | Not yet inside Codex |
| Any other tool (Cursor, Windsurf, local models) | `init --instructions AGENTS.md` (or the tool's rule file) | A rule block that tells the model the steps | Works wherever the model can run shell commands |

### What you need

- Python 3 (tested on 3.14). The script uses the standard library only: no packages, no network and no model calls.
- A model or tool that can run shell commands. Hooks are optional.

### Install

1. Copy the `CTX-PLINE` folder to where your tool finds skills, and name the copy `ctx-pline` (the `name` in
   `SKILL.md`). For Claude Code, use `~/.claude/skills/ctx-pline/` for all projects, or `.claude/skills/ctx-pline/`
   for one project.
2. From the root folder of your project, run the setup command for your tool, for example:

   ```bash
   python ~/.claude/skills/ctx-pline/engine/ctx.py init --claude
   ```

3. Check the memory: `python .claude/context/ctx.py status` (use the folder that `init` printed).
4. Commit the memory folder (for example `.ctx/` or `.claude/context/`) with your project.

If `init` finds a settings file that exists, it does not change it and prints `FLAG`. Run the command again with
`--merge` to add the hooks to that file.

### Privacy

- The memory stays in your project folder. The script sends nothing over the network.
- An automatic entry from the end hook holds the first 160 characters of each of your prompts. Read the memory folder
  before you push it to a public repository.

Read more: [CTX-PLINE/README.md](../CTX-PLINE/README.md) · [CTX-PLINE/SETUP.md](../CTX-PLINE/SETUP.md)

---

## License

Each skill has its own MIT license in its folder:

- [DocPC/LICENSE](../DocPC/LICENSE)
- [CTX-PLINE/LICENSE](../CTX-PLINE/LICENSE)
