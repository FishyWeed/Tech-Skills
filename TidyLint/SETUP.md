# Set up TidyLint

This file is for people. It tells you how to get the skill, install it, use it, update it and remove it.
[SKILL.md](SKILL.md) holds the rules that a model follows.

## What you need

- A model or agent that can read files, edit files and run shell commands.
- Git in the project. TidyLint compares each pass with the code before it, and you review each pass as a diff.
- The formatter, linter and tests of your project. If the project has no formatter or linter, TidyLint suggests the
  standard ones for the language and adds them only after you approve.
- A POSIX shell for the search commands (on Windows, Git Bash).

TidyLint has no install step, no packages of its own and no network calls.

## 1. Get the skill

TidyLint is the `TidyLint` folder in the Tech-Skills repository. Get the repository:

```bash
git clone https://github.com/FishyWeed/Tech-Skills.git
```

## 2. Install it

Copy the `TidyLint` folder to where your tool can find it. Name the copy `tidylint`: the Agent Skills standard needs
the folder name to match the `name` in `SKILL.md`, in lowercase letters.

| Tool | Where |
| --- | --- |
| Claude Code | `~/.claude/skills/tidylint/` (all your projects) or `.claude/skills/tidylint/` (one project). Claude Code reads `SKILL.md`. |
| Any other tool | Any folder outside your projects. Tell the model to read `AGENTS.md` in it. |

To check the install in Claude Code, start a new session and type `/tidylint check`. TidyLint surveys the project and
shows a plan. It changes nothing in this mode.

## 3. Use it

1. Commit your work first, so that the cleanup diff stays apart from your own changes.
2. Start TidyLint in the project root with a mode:

   | Mode | Command | What it does |
   | --- | --- | --- |
   | Full | `/tidylint` or `/tidylint <folder>` | All five passes |
   | Check | `/tidylint check` | Survey and plan only; no changes |
   | Changed files | `/tidylint changed <commit>` | Only the files changed since `<commit>` |
   | One pass | `/tidylint pass <1-5>` | Only that pass |

   In other tools, say the same in words, for example "Use TidyLint in check mode".
3. Answer the questions and approve the plan. TidyLint makes no change before you approve.
4. Review the report and the diff of each pass. Commit when you agree. TidyLint suggests a commit message for each pass.

If a session stops in the middle of a run, start TidyLint again in the same project. It finds the progress file in the
system temporary folder and asks whether to continue.

## 4. Update it

Get the new version (`git pull` in your clone), then copy the `TidyLint` folder over your installed copy again.

## 5. Remove it

Delete the installed folder (for example `~/.claude/skills/tidylint/`). TidyLint keeps no files in your projects, and
it keeps no record of them in its own folder.
