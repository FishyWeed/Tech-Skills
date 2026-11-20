# Set up CTX-PLINE

This file is for people. It tells you how to get the skill, add memory to a project, check it, update it and remove
it. [README.md](README.md) holds the rules that a model follows.

## What you need

- Python 3 (the supported versions are in [README.md](README.md)). The skill uses the standard library only.
- A model or tool that can run a shell command. Hooks are optional.
- Nothing else: no install step, no network and no model calls from the script.

## 1. Get the skill

CTX-PLINE is the `CTX-PLINE` folder in the Tech-Skills repository. Get the repository:

```bash
git clone https://github.com/FishyWeed/Tech-Skills.git
```

Copy the `CTX-PLINE` folder to where your tool can find it. Name the copy `ctx-pline`: the Agent Skills standard
needs the folder name to match the `name` in `SKILL.md`, in lowercase letters, digits and hyphens.

| Tool | Where |
|---|---|
| Claude Code | `~/.claude/skills/ctx-pline/` (all your projects) or `.claude/skills/ctx-pline/` (one project). Claude Code reads `SKILL.md`. |
| Any other tool | Any folder. Tell the model to read `README.md` in it, or use step 2 with `--instructions`. |

To check the skill, run its tests from the skill folder:

```bash
python -m unittest discover -s tests
```

## 2. Add memory to a project

Run one command from the root folder of the project. `<skill>` is the folder from step 1.

| Your tool | Command | Details |
|---|---|---|
| Claude Code | `python <skill>/engine/ctx.py init --claude` | [hooks/claude/](hooks/claude/README.md) |
| Gemini CLI | `python <skill>/engine/ctx.py init --hooks gemini` | [hooks/gemini/](hooks/gemini/README.md) |
| Codex | `python <skill>/engine/ctx.py init --instructions AGENTS.md` | [hooks/codex/](hooks/codex/README.md) |
| A tool with no hooks | `python <skill>/engine/ctx.py init --instructions AGENTS.md` (or the rule file of your tool) | [hooks/any/](hooks/any/README.md) |

[workflow/0-set-up.md](workflow/0-set-up.md) lists every `init` option.

- If `init` prints `FLAG`, a settings file exists already, and `init` did not change it. Read the flag, then run
  the same command again with `--merge` to add the hooks to that file.
- Commit the memory folder (for example `.ctx/` or `.claude/context/`) with the project, so the memory travels
  with the code.

## 3. Check that it works

From the project root (use the folder that `init` printed):

```bash
python .ctx/ctx.py status
python .ctx/ctx.py load --slim
```

A new memory says "nothing saved yet". After the first save, `load --slim` prints the open tasks, issues, decisions
and facts. If your tool has hooks, start a new session: the start view appears without a command.

## 4. Use it

You do not need to learn the commands. The model reads [README.md](README.md) and follows the workflow. You only:

- ask the model to save near the end of a session (in Claude Code: `/save`), and
- read the session number and new IDs that it reports.

## 5. Update the skill

1. Get the new version: run `git pull` in your Tech-Skills clone, then copy its `CTX-PLINE` folder over your
   `ctx-pline` copy from step 1.
2. In each project that uses the skill, run the same `init` command again from step 2.

`init` then replaces the project's copy of `ctx.py` and keeps the memory and the settings. It does not change hooks
that exist. If the new version writes other hook commands, edit them by hand (see [hooks/](hooks/README.md)).

## 6. Remove it from a project

**Caution:** the memory folder holds the saved history. Delete it only if you do not need that history.

1. Delete the memory folder (`.ctx/`, `.context/`, `.agents/context/` or `.claude/context/`).
2. Remove the hook entries that call `ctx.py` from the tool's settings file (`.claude/settings.json` or
   `.gemini/settings.json`).
3. Delete `.claude/commands/save.md`, if `init --claude` made it.
4. Remove the block between the two `<!-- CTX-PLINE -->` lines in `AGENTS.md` or your rule file.
