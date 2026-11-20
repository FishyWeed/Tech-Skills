# OpenAI Codex

`init` has no Codex hook setup. Use the rule block, and add the hooks by hand if your Codex version has hooks.

## Set up

1. Run `python <skill>/engine/ctx.py init --instructions AGENTS.md`. Codex reads `AGENTS.md`, so the model gets
   the rules even without hooks.
2. If your Codex has command hooks, add these to its hook settings. Use the format of your Codex version.

| Event | Command |
|---|---|
| `SessionStart` | `python .ctx/ctx.py load --slim --hook codex` |
| `UserPromptSubmit` | `python .ctx/ctx.py recall --hook codex` |

With `--hook codex`, the output is `hookSpecificOutput.additionalContext` JSON.

`autosave` understands Codex rollout JSONL. If your Codex has no hook at the end of a session, run
`python .ctx/ctx.py autosave --transcript <rollout file>` by hand when a session ended without a save.

## Skill install

Copy or link the skill folder to `~/.agents/skills/ctx-pline/` (all projects) or `.agents/skills/ctx-pline/` (one
project).

## Not checked

The output has unit tests, but the hooks have not run inside Codex. The event names come from third-party guides to
Codex hooks. Check them against the hook docs of your Codex version.
