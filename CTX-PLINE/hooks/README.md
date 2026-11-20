# Hooks: connect the workflow to a harness

A hook lets the harness run a step for the model. With hooks, the model does not need to remember steps 1 and 2,
and a session that ends without a save still gets an `(auto)` entry.

| Step | Hook command | Claude Code | Gemini CLI | Codex |
|---|---|---|---|---|
| 1. Start | `CTX load --slim` | `SessionStart` | `SessionStart` (`--hook gemini`) | `SessionStart` (`--hook codex`) |
| 2. Recall | `CTX recall` | `UserPromptSubmit` | `BeforeAgent` (`--hook gemini`) | `UserPromptSubmit` (`--hook codex`) |
| End | `CTX autosave` | `SessionEnd` (`--hook claude`) | `SessionEnd` (`--hook gemini`) | by hand |

Each harness has its own folder:

| Folder | Harness | How to set it up |
|---|---|---|
| [claude/](claude/README.md) | Claude Code | `init --hooks claude`, or copy `claude/settings.json` |
| [gemini/](gemini/README.md) | Gemini CLI, Antigravity | `init --hooks gemini`, or copy `gemini/settings.json` |
| [codex/](codex/README.md) | OpenAI Codex | by hand |
| [any/](any/README.md) | Any harness without hooks: Cursor, Windsurf, Aider, local models | `init --instructions AGENTS.md` |

## Output formats

- Claude Code reads plain text on stdout. Use no `--hook` option for `load` and `recall`.
- Gemini CLI and Codex read JSON: `{"hookSpecificOutput": {"hookEventName": "...", "additionalContext": "..."}}`.
  Add `--hook gemini` or `--hook codex`. When `recall` finds nothing, it prints `{}`.
- `autosave` reads the hook JSON on stdin (`transcript_path`) or `--transcript <path>`. It understands Claude Code
  JSONL, Gemini CLI JSON, Codex rollout JSONL and generic `{"role": ..., "content": ...}` JSON or JSONL.

The files in these folders use `.ctx/`. If the project uses another memory folder, change the path in each command.

Hook commands start the script through the harness variable for the project folder (`$CLAUDE_PROJECT_DIR`,
`$GEMINI_PROJECT_DIR`), not through a relative path. A hook runs in the session's current folder. If the session
moves into a subfolder, a relative path such as `.ctx/ctx.py` is not found there.
A unit test checks that `claude/settings.json` and `gemini/settings.json` match what `init` writes.
