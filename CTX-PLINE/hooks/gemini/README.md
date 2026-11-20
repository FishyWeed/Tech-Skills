# Gemini CLI and Antigravity

## Set up

Run one of these from the project root:

- `python <skill>/engine/ctx.py init --hooks gemini`: memory in `.ctx/` and the hooks in `.gemini/settings.json`.
- `python <skill>/engine/ctx.py init --agents --instructions GEMINI.md`: memory in `.agents/context/` and a rule
  block in `GEMINI.md`, for Antigravity.

If `.gemini/settings.json` exists, `init` prints a `FLAG` and changes nothing. Ask the user, then run it again with
`--merge`. You can also copy the parts of [settings.json](settings.json) by hand.

## What the hooks do

| Event | Command | Effect |
|---|---|---|
| `SessionStart` | `python "$GEMINI_PROJECT_DIR/.ctx/ctx.py" load --slim --hook gemini` | Adds the slim view to the start of the session |
| `BeforeAgent` | `python "$GEMINI_PROJECT_DIR/.ctx/ctx.py" recall --hook gemini` | Adds the decisions and facts that match each prompt, for that turn only |
| `SessionEnd` | `python "$GEMINI_PROJECT_DIR/.ctx/ctx.py" autosave --hook gemini` | Writes an `(auto)` entry if the session had no save |

With `--hook gemini`, the output is `hookSpecificOutput.additionalContext` JSON, as Gemini CLI reads it.

## Skill install

Copy or link the skill folder to `~/.gemini/config/skills/ctx-pline/` (all projects) or `.agents/skills/ctx-pline/`
(one project).

## Not checked

The hooks have unit tests for their output, but they have not run inside Gemini CLI. The event names come from the
Gemini CLI hooks reference.
