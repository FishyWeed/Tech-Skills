---
name: tidylint
description: TidyLint. Cleans up the code of any project with no change in behavior - lint and format, merge duplicate code into reusable modules, split big functions and files, remove the signs of generated code and the comments that only repeat the code. Works for any language and project type (web, API, CLI, library, app, scripts). Modes - full cleanup, check only, changed files only, one pass only. Use when the user asks to clean, tidy, lint, format, refactor or "humanize" a project's code, or types /tidylint.
---

# TidyLint

TidyLint cleans up the code of a project in five passes. Each pass keeps the behavior of the program the same, and
the checks and a behavior snapshot prove it. In this file, `<skill>` is the folder that holds this file, and `<tmp>` is
the temporary folder of the run (see "Start").

## Rules (read first)

- **Do not change behavior.** Keep the same inputs, outputs, routes, API, database schema, file formats and visible
  text. Tests and screenshots often read the visible text, so do not reword it. Output that reaches a person or a
  tool is behavior too: `stdout`, `stderr`, pages, responses and log files that people or tools read.
- **Ask before a change in behavior, even a small one** (for example, to remove debug output that goes to `stdout`).
  If the user approves it, list it in the report. The snapshot must then differ only in that place.
- **Rename or reshape an internal name only with all its users.** Change every caller and test in the same pass, and
  keep the expected values of the tests. Also search for the old name as a string: dynamic imports, templates,
  reflection, routes, config files, docs and scripts can use it.
- **Keep the names that other tools read:** doc and snippet markers, region tags, test IDs, CSS classes and element IDs
  that tests use, translation keys, generated-code markers and public API names.
- **Prove each pass.** Run the same checks and the same behavior snapshot before and after each pass. If a result
  changes, fix it or undo the pass before you continue.
- **The project's own rules win.** Read the project guide (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md`)
  first. If it conflicts with this file, follow the project and tell the user.
- **Add nothing that the user did not approve.** Ask before you add a dependency, a config file or a new tool. Use the
  tools that the project already has.
- **Edit code with your file-edit tool, one change at a time.** Do not edit code with regex or search-and-replace
  scripts: they break on exact whitespace and on similar names. Formatters and linter fixes are safe to run.
- **Do not commit or push unless the user asks.** Do not make a branch unless the user asks.
- **Add no AI traces to the project:** no notes, prompts, context files or AI names in the code, comments, config,
  `.gitignore` or commit messages.
- **Remember nothing about the project.** Write nothing about it in `<skill>`, in your memory or anywhere outside the
  project and `<tmp>`. Each run starts from the project alone. Delete `<tmp>` at the end.

## Modes

The user names the mode in words or after the command. The scope (folders or files) can go with every mode.

| Mode | Example | What it does |
| --- | --- | --- |
| Full (default) | `/tidylint`, `/tidylint src/api` | "Start", the five passes, "Finish" |
| Check | `/tidylint check` | "Start" up to the plan. It changes nothing and reports the plan with its numbers. |
| Changed files | `/tidylint changed <commit>` | Scope = files changed since `<commit>`: `git diff --name-only <commit>` and `git ls-files --others --exclude-standard`. If no commit is given, ask which commit the work started from. |
| One pass | `/tidylint pass 5` | "Start", only that pass, "Finish" |

## Start

1. **Make `<tmp>`** outside the project, in the system temporary folder: `tidylint-<project folder name>`. If it
   already holds `progress.md`, an earlier run stopped. Show it to the user and ask whether to continue that run.
2. **Get the mode and the scope.** The default is the full mode on the whole project.
3. **Check the working tree.** If git shows uncommitted changes, tell the user and recommend a commit first: mixed
   changes make the cleanup diff hard to review. In the changed-files mode, uncommitted changes are normal. If the
   project is not in git, ask the user to commit it to a new repository, or copy the scope to `<tmp>/original/`.
4. **Find the stack, the project type and the commands:** language, framework, package manager, and the commands for
   format, lint, type check, test and build (`package.json` scripts, `pyproject.toml`, `Makefile`, `*.csproj`, CI
   files). Project types are in `<skill>/references/proof.md`. Ask the user: "Do other projects or people use this code
   as a library or an API?" If yes, its public names and signatures stay.
5. **Run the baseline.** Run every check and save the results in `<tmp>`. Record the checks that already fail. Do not
   fix them now; tell the user, and keep them out of the comparison.
6. **Take the behavior snapshot** for the project type, as `<skill>/references/proof.md` says. Save it in
   `<tmp>/before/`. If the tests cover little of the code, tell the user: the snapshot is then the main proof.
7. **Survey the code.** "Find the problems" in `<skill>/references/stacks.md` gives the commands. List:
   - the largest files, the longest functions, the deepest nesting and the repeated blocks;
   - the documents and scripts that copy code from the scope (they need a rebuild after the cleanup).
8. **Show the plan and wait for the user's approval** before the first change:
   - the passes, and the modules that you will make, merge or delete;
   - the numbers from the survey;
   - what the proof covers and what it does not cover;
   - whether the size rules of pass 1 stay in the linter config after the run (the default is no).

   In the check mode, stop here, delete `<tmp>` and report.
9. **Plan batches for a big scope.** If the scope does not fit in one session, work one folder at a time. After each
   pass or batch, write `<tmp>/progress.md`: the mode, the scope, the commands, the passes and batches done, the files
   still to do and where the baseline is. Write nothing else about the project in it.

## Passes

Do the passes in this order. Each pass is one reviewable step. After each pass, run the checks and take the snapshot
again into `<tmp>/after/`, then compare it with `<tmp>/before/`.

### Pass 1: Format and lint

1. Use the formatter and the linter that the project has. If it has none, suggest the standard pair for the stack from
   `<skill>/references/stacks.md`, and add them only after the user approves. Also format the styles, markup, SQL and
   shell scripts in scope when the project has tools for them.
2. Turn on the size rules of the linter (`references/stacks.md`) as warnings, so that the linter lists the big blocks
   for pass 3.
3. Run the formatter on all files in scope.
4. Run the linter with its automatic fixes. Then fix the remaining errors by hand, one rule at a time.
5. Do not disable a rule to make an error go away. If a rule is wrong for the project, ask the user.
6. Measure the scope again: files, lines and the longest function. Use these numbers as "before" for passes 2 to 5. A
   formatter can add many lines to dense code, and these lines are not part of the refactor.

### Pass 2: Merge duplicates into reusable modules

1. For each repeated block (code, markup, styles, queries, constants, types), make one shared module and use it in
   every place. Fix all copies, not only one.
2. Put each shared module where the project keeps that kind of thing. If the project has no place, use the usual place
   of the framework (for example `src/lib/` in SvelteKit, `src/components/` in React, `app/Services/` in Laravel, a
   package module in Python or Go).
3. Pass the project-specific data in as parameters, so that the module also works in another project. Make a
   parameter only for data that differs between the current callers. Do not add options for later.
4. Give each component its own file, with its own markup and styles. A page only arranges components.
5. Keep settings in config files, data in data files and secrets in one `.env` file.
6. Make a shared module only for code that two or more places use, or that has a clear name of its own. Do not make
   a wrapper that only calls one function, or a "utils" file of unrelated parts.
7. Delete the code that the merge makes redundant: old copies, unused exports, unused files and dead branches. The
   dead-code finders in `references/stacks.md` help; check each result by hand before you delete it.

### Pass 3: Split big blocks

Split a block that is larger than these limits, unless the split makes it harder to read:

| Item | Limit |
| --- | --- |
| Function or method | 40 lines |
| File | 300 lines |
| Component markup (JSX, Svelte, Vue, HTML template, XAML) | 100 lines |
| Nesting depth | 3 levels |
| Parameters | 4 (use one object for more) |
| Branches in one function (complexity) | 10 |

- Split along one job: each part does one thing and has a name that says what. Do not cut a function into numbered
  parts only to meet a limit.
- Use early returns instead of deep `if` nesting.
- Turn a long run of near-identical lines into data (a table or a list) and one loop or one function.
- Move a large inline callback, query or style block into a named function, module or component.
- Keep the order of steps that change the result: sums of floating-point numbers, the order of output and side
  effects.

### Pass 4: Make the code read as human-written

Remove the signs of generated code (pass 5 owns the comments):

- Defensive code for states that cannot happen: checks after a type already guarantees the value, `try`/`catch` that
  only logs and throws again, optional chaining on values that are never empty. Before you remove a check, find where
  the value comes from. Data from files, users, the network or a database can reach states that look impossible:
  keep that check, and give it a comment that says which input reaches it.
- Type annotations and casts that the compiler already infers, unless the project style wants them.
- Generic names: `data`, `result`, `item`, `temp`, `obj`, `handleClick2`, `helper`, `manager`, `processData`. Use
  names from the domain of the project (`pendingRequests`, `approveTool`).
- Unused options, flags and parameters "for later"; factories or classes that only hold plain functions.
- Leftover `console.log` or `print` debugging, emoji in code or logs, and log messages for normal steps. If this
  output reaches a person or a tool, ask first (see "Rules").
- Mixed styles for the same job. Use the pattern that most of the project uses, in every file.

Make the code read like a careful person wrote it:

- Order each file the same way: imports, types, constants, the main export, then its helpers.
- Keep each function at one level of detail, so that it reads from top to bottom.
- Use the idioms of the language and the framework, not a pattern from another language.
- Keep names short but exact. Use one name for one thing in all files.

### Pass 5: Comments

Delete every comment that the code already says: banners (`// ===== Helpers =====`), step comments (`// Step 1: fetch
the data`), comments that read the code aloud, doc comments that only repeat the parameter names and types, and
commented-out code. Keep a comment only if it gives one of these:

- a reference: a link to a spec, an issue, a standard, a paper or library documentation;
- a reason that the code cannot show: a workaround for a bug (with the version), a limit of a platform, the source of a
  number or the meaning of a hard regular expression;
- a tool directive that the build needs (`eslint-disable-next-line`, `@ts-expect-error`, `# noqa`), with its reason;
- a marker that another tool reads (see "Rules");
- a license header, or the documentation of a public API that the project publishes.

Write each comment that stays as one short line about why, not what.

## Finish

1. Run every check of the baseline again, and take the snapshot again. The results must match the baseline: the same
   tests pass, the build works and the snapshot shows no change. Run the formatter and the linter one last time.
2. If the project has a user interface, look at the changed screens, also the ones that open only after a click
   (dialogs, menus, popups). `references/proof.md` tells how.
3. Search the scope for leftovers: debug output, commented-out code, unused imports and files, and TODO notes with no
   owner.
4. **Review the diff for behavior changes.** If your tool can start a second agent or has a code-review command, ask it
   to read the whole diff and report only behavior changes and the signs in the pass 4 list. If not, read the whole
   diff again yourself with the same two questions. Fix what the review finds, then run step 1 again.
5. If the user chose to remove the size rules, remove them from the linter config.
6. Write the report (below). Then delete `<tmp>`.

### Report

Use this layout every time. "Before" for passes 2 to 5 is the measurement after pass 1.

| Pass | Files changed | Lines before → after | Longest function before → after | Duplicates merged | Comments removed |
| --- | --- | --- | --- | --- | --- |
| 1. Format and lint | | | | - | - |
| 2. Reusable modules | | | | | - |
| 3. Small blocks | | | | - | - |
| 4. Human-written | | | | - | - |
| 5. Comments | | | | - | |

| Check | Before | After |
| --- | --- | --- |
| (each check of the baseline, and the snapshot) | | |

Then list:

- what the snapshot compared, and what the proof did not cover;
- the checks that already failed before the cleanup;
- the documents and scripts that copy code and need a rebuild;
- what you could not verify;
- a suggested commit message for each pass (commit only if the user asks).
