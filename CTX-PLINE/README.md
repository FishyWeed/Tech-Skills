# CTX-PLINE (Context Pipeline)

Session memory for software projects that works with any model in any harness. The memory lives in the project as
plain files. One Python script (`engine/ctx.py`: Python 3, tested on 3.14, standard library only, no network, no
LLM calls) reads and writes it. Any model that can run a shell command can use it.

**If you are a model: this file holds every rule you need.** The other folders hold details for one step each.
People who install the skill: read [SETUP.md](SETUP.md).

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
