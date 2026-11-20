# Any harness without hooks

Use this for Cursor, Windsurf, Aider, local models or any other harness that can run a shell command. Without
hooks, the model runs each step itself, so the project needs a rule block that tells it to.

## Set up

Run from the project root, with the instruction file that the harness reads:

```bash
python <skill>/engine/ctx.py init --instructions AGENTS.md
```

Other file names work too: `CLAUDE.md`, `GEMINI.md`, `.cursorrules` or `.windsurfrules`. Use `--instructions` more
than once for more files. `init` puts the block between `<!-- CTX-PLINE -->` markers. If you run it again, it
replaces the block and keeps the rest of the file.

[AGENTS-block.md](AGENTS-block.md) shows the block for a project with `.ctx/`.

## If the harness reads no instruction file

Give the model the top [README.md](../../README.md) of the skill, or paste the block into its system prompt.

## If the session ends without a save

Run `python .ctx/ctx.py autosave --transcript <file>` with the transcript of the session, if the harness writes one.
