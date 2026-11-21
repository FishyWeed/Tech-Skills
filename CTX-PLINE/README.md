# CTX-PLINE (Context Pipeline)

Session memory for software projects that works with any model in any harness. The memory lives in the project as
plain files. One Python script (`engine/ctx.py`: Python 3, tested on 3.14, standard library only, no network, no
LLM calls) reads and writes it. Any model that can run a shell command can use it.

**If you are a model: this file holds every rule you need.** The other folders hold details for one step each.
People: read [About CTX-PLINE](#about-ctx-pline-for-people) at the end of this file, then [SETUP.md](SETUP.md).

## Rules

1. Run every command from the project root. `CTX` below means the project copy of the script:
   `python .ctx/ctx.py` (or `.context/ctx.py`, `.agents/context/ctx.py`, `.claude/context/ctx.py`, whichever
   exists). If the project has no copy, use `python <this folder>/engine/ctx.py`. Use `python3` if `python` is absent.
2. Treat open decisions (`D-*`) and facts (`F-*`) as binding project rules, unless the user overrides them.
3. Never write files in the memory folder by hand. Never load `ledger.json` into your context. Use the commands.
4. If a hook already added context to your prompt, do not load it again. The hook text starts with
   `# Slim context`, `# Project context` or `Project context that may apply to this prompt`.

## The workflow

| Step | When | Command | Details |
|---|---|---|---|
| 0. Set up | Once, when the user asks | `python <this folder>/engine/ctx.py init` | [workflow/0-set-up.md](workflow/0-set-up.md) |
| 1. Start | Start of a session | `CTX load --slim` | [workflow/1-start.md](workflow/1-start.md) |
| 2. Recall | Before each new task | `CTX recall <task words>` | [workflow/2-recall.md](workflow/2-recall.md) |
| 3. Look up | When you need an old item | `CTX find <words>` · `CTX show <ID>` | [workflow/3-look-up.md](workflow/3-look-up.md) |
| 4. Save | End of a session or milestone | `CTX next`, then `CTX save` | [workflow/4-save.md](workflow/4-save.md) |

### 0. Set up

Only when the user asks: `python <this folder>/engine/ctx.py init`. It makes `.ctx/`, copies the engine into it and
compiles. Options: `--agents` (`.agents/context/`), `--claude` (`.claude/context/` with a `/save` command),
`--hooks claude,gemini` (start, prompt and end hooks), `--instructions AGENTS.md` (a rule block for harnesses
without hooks) and `--merge` (change a settings file that exists).

### 1. Start

Run `CTX load --slim`. It prints all open tasks and issues in full, the 30 newest decisions and facts as short
lines and the last two session summaries. On a small project, `CTX load` (the full digest) is also fine.

### 2. Recall

Before you start a new task, run `CTX recall <words of the task>`. It prints the full text of the open decisions and
facts that match, or nothing. If the harness has a prompt hook (see [hooks/](hooks/README.md)), the hook runs it on
each prompt for you.

### 3. Look up

- `CTX find <words>`: search all items, open and closed. Add `--open`, `--closed` or `--kind D,F` to filter.
- `CTX show D-10 F-2..F-5 s0014`: print items or a session in full.
- `CTX status`: counts, the size of the digest and possible duplicate items.

### 4. Save

1. Run `CTX next`. It prints the next session number, the live items and the format. If it says the latest entry
   was auto-recorded, your entry replaces it, so cover that work too.
2. Write the entry. Record only what a future session needs, in less than 4,000 characters:

   ```markdown
   Summary: One or two sentences on what this session did.

   D: A decision, with the reason
   F: A fact you checked
   T: An open task
   I: A known issue
   X: T-1, T-2 why these items are done, wrong or replaced
   F~3: New text that replaces F-3 (closes F-3 and adds a new fact)

   ## Notes
   - At most 10 lines of detail for the next session
   ```

   Do not give new items IDs. The script adds them.
3. Save it with one of these: `CTX save --file entry.md`, `CTX save --text "Summary: ...\nD: ..."` or pipe the
   entry into `CTX save` on stdin.
4. Tell the user the session number and the new IDs in one line.
5. If `save` prints a `Hint` about duplicate items, close the older ones with `X:` in the next entry.

## Folders

```
CTX-PLINE/
  README.md      this file: every rule a model needs
  SETUP.md       for people: get the skill, add it to a project, update and remove it
  SKILL.md       front matter for harnesses that load skills; it points here
  LICENSE        MIT
  engine/        ctx.py, the one-file engine (init copies it into each project)
  workflow/      one file per step: 0-set-up, 1-start, 2-recall, 3-look-up, 4-save
  hooks/         one folder per harness: claude, gemini, codex, any (no hooks)
  reference/     storage, compression, ranking and measured token costs
  tests/         offline unit tests: python -m unittest discover CTX-PLINE/tests
```

## About CTX-PLINE (for people)

This part is for people who want to know what the skill does. A model does not need it: the rules above are complete.

CTX-PLINE gives a software project a memory that lasts across sessions, models and tools. A new session starts with
what earlier sessions decided and learned. You do not explain the project again, and the model does not search the
code again to find old decisions. The memory lives in the project as plain files, so it travels with the code in git.

### What it keeps

| Kind | ID | Example |
| --- | --- | --- |
| Decision | `D-1` | A choice for the project, with the reason |
| Fact | `F-1` | Something that a session checked |
| Task | `T-1` | Open work |
| Issue | `I-1` | A known problem |
| Session | `s0001` | A short summary of one session |

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
[reference/internals.md](reference/internals.md).

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

1. Copy this folder to where your tool finds skills, and name the copy `ctx-pline` (the `name` in `SKILL.md`). For
   Claude Code, use `~/.claude/skills/ctx-pline/` for all projects, or `.claude/skills/ctx-pline/` for one project.
2. From the root folder of your project, run the setup command for your tool, for example:

   ```bash
   python ~/.claude/skills/ctx-pline/engine/ctx.py init --claude
   ```

3. Check the memory: `python .claude/context/ctx.py status` (use the folder that `init` printed).
4. Commit the memory folder (for example `.ctx/` or `.claude/context/`) with your project.

If `init` finds a settings file that exists, it does not change it and prints `FLAG`. Run the command again with
`--merge` to add the hooks to that file. [SETUP.md](SETUP.md) has every step, also to update and remove the skill.

### Privacy

- The memory stays in your project folder. The script sends nothing over the network.
- An automatic entry from the end hook holds the first 160 characters of each of your prompts. Read the memory folder
  before you push it to a public repository.
