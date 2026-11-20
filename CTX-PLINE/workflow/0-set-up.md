# 0. Set up memory in a project

Do this only when the user asks. Run it from the project root.

```bash
python <skill>/engine/ctx.py init [--agents | --claude] [--hooks claude,gemini] [--instructions AGENTS.md] [--merge]
```

| Option | Effect |
|---|---|
| (none) | Makes `.ctx/`, or uses a memory folder that exists (`.context/`, `.agents/context/`, `.claude/context/`). |
| `--agents` | Makes `.agents/context/`. |
| `--claude` | Makes `.claude/context/`, a `/save` command in `.claude/commands/save.md` and the Claude Code hooks. |
| `--hooks claude,gemini` | Adds the start (`load --slim`), prompt (`recall`) and end (`autosave`) hooks. See [hooks/](../hooks/README.md). |
| `--instructions FILE` | Adds a rule block between `<!-- CTX-PLINE -->` markers to `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.cursorrules` or `.windsurfrules`. Use it for a harness without hooks. Running it again replaces the block. |
| `--merge` | Lets `init` change a settings file that exists. Without it, `init` changes nothing in that file and prints a `FLAG`. |

## What init does

1. It makes the memory folder with a `sessions/` folder.
2. It copies `engine/ctx.py` into the memory folder, so every model can run the project copy.
3. It writes a short `README.md` for people into the memory folder.
4. It compiles the memory and prints the commands to start and save.

## Cautions

- If `init` prints `FLAG`, a settings file exists. Ask the user before you run it again with `--merge`.
- `init` does not change hooks that exist. To move an older project to `load --slim`, `recall` and hook paths
  through `$CLAUDE_PROJECT_DIR` (see [hooks/](../hooks/README.md)), edit its settings file by hand.
- After you change `engine/ctx.py` in the skill, copy it again into each project that uses it.

## For launchers: offer memory once per project

A launcher or a start hook can offer memory in projects that do not have it:

- `ctx.py should-offer` exits with 0 if the current folder is a real project with no memory folder, and the user
  did not decline it.
- `ctx.py offer` prints an instruction for a Claude Code `SessionStart` hook: ask the user, then run
  `init --claude` or `decline`. It prints nothing when `should-offer` would exit with 1.
- `ctx.py decline` adds the current folder to `~/.ctx-pline/declined.txt`. Remove the line to be asked again.
