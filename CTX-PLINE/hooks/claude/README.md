# Claude Code

## Set up

Run one of these from the project root:

- `python <skill>/engine/ctx.py init --claude`: memory in `.claude/context/`, a `/save` command and the hooks.
- `python <skill>/engine/ctx.py init --hooks claude`: memory in `.ctx/` and the hooks.

If `.claude/settings.json` exists, `init` prints a `FLAG` and changes nothing. Ask the user, then run it again with
`--merge`. You can also copy the parts of [settings.json](settings.json) into the project's `.claude/settings.json`
by hand.

## What the hooks do

| Event | Command | Effect |
|---|---|---|
| `SessionStart` | `python "$CLAUDE_PROJECT_DIR/.ctx/ctx.py" load --slim` | Adds the slim view to the start of the session |
| `UserPromptSubmit` | `python "$CLAUDE_PROJECT_DIR/.ctx/ctx.py" recall` | Adds the decisions and facts that match each prompt |
| `SessionEnd` | `python "$CLAUDE_PROJECT_DIR/.ctx/ctx.py" autosave --hook claude` | Writes an `(auto)` entry if the session had no save |

The permission rule `Bash(python .ctx/ctx.py save*)` lets the model save without a prompt.

## Skill install

Copy or link the skill folder to `~/.claude/skills/ctx-pline/` (all projects) or `.claude/skills/ctx-pline/` (one
project). Claude Code reads `SKILL.md`, which points to the top `README.md`.
