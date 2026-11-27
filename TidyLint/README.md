# TidyLint

TidyLint is an AI skill that cleans up the code of a project with no change in behavior. It works for any language
and any project type: web apps, APIs, command-line tools, libraries, mobile and desktop apps, and scripts. It works
with any model or agent that can read files and run commands.

It does five passes. Before and after each pass, it runs the project's checks and a behavior snapshot:

| Pass | What it does |
| --- | --- |
| 1. Format and lint | Runs the project's formatter and linter, fixes the errors and turns on size warnings. |
| 2. Reusable modules | Merges duplicate code, markup, styles and queries into shared modules and components, and deletes the old copies and dead code. |
| 3. Small blocks | Splits functions, files and markup that are too large: 40 lines for a function, 300 for a file, 3 levels of nesting. |
| 4. Human-written | Removes the signs of generated code: defensive code for impossible states, generic names, unused options, debug output, mixed styles. |
| 5. Comments | Keeps only comments that give a reference or a reason that the code cannot show. |

## Modes

| Mode | Command | What it does |
| --- | --- | --- |
| Full | `/tidylint` or `/tidylint <folder>` | All five passes |
| Check | `/tidylint check` | Survey and plan only; no changes |
| Changed files | `/tidylint changed <commit>` | Only the files changed since `<commit>` |
| One pass | `/tidylint pass <1-5>` | Only that pass |

## How it proves that nothing changed

- It runs the project's own checks (type check, tests, build) before and after each pass.
- It takes a behavior snapshot before the first change, and compares it after each pass: the HTML of each page, the
  responses of an API, the output of a command, the public API of a library or screenshots of screens.
- At the end, a second agent or a code review reads the whole diff only for behavior changes.
- The report says what the proof covered and what it did not.

## Install

See [SETUP.md](SETUP.md).

## Rules that it keeps

- It does not change behavior, visible text, routes, the API, the database schema or the names that other tools read.
- It makes no change before you approve the plan. It asks before it adds a dependency, a config file or a tool.
- It does not commit or push unless you ask. It suggests one commit message for each pass.
- It adds no AI notes or files to your project.
- It remembers nothing about your project. Its temporary files stay in the system temporary folder, and it deletes
  them at the end.
- Your project's own guide (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`) wins over the skill.

## Limits

- The proof is only as good as the checks and the snapshot. The report names the paths that they did not reach.
- The snapshot does not measure speed or memory use.
- "Human-written" means clean, consistent code that follows the idioms of the language. It does not promise that a
  tool or a person cannot tell that a model worked on it.

## Files

| File | For |
| --- | --- |
| `SKILL.md` | The model: the rules, the modes, the start steps, the five passes and the report |
| `references/stacks.md` | The formatter, linter, size rules and dead-code finders for each language, and the commands that find the problems |
| `references/proof.md` | The behavior snapshot for each project type |
| `SETUP.md` | People: install, use, update and remove |
| `AGENTS.md` | Other agents: where to start |

## License

MIT. See `LICENSE`.
