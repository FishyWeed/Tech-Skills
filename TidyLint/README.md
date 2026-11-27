# TidyLint

TidyLint is an AI skill that cleans up the code of a project with no change in behavior. It formats and lints the
code, merges duplicate code into reusable modules, splits big functions and files, removes the signs of generated
code and deletes the comments that only repeat the code. After the cleanup, the code reads as if a careful person
wrote it.

TidyLint works for any language and any project type: web apps, APIs, command-line tools, libraries, mobile and
desktop apps, games and scripts. It works with any model or agent that can read files, edit files and run shell
commands. In Claude Code, you start it with `/tidylint`.

This file is for people. [SKILL.md](SKILL.md) holds the rules that a model follows, and [SETUP.md](SETUP.md) tells you
how to install it.

## Contents

- [Why use it](#why-use-it)
- [How a run works](#how-a-run-works)
- [The five passes](#the-five-passes)
- [Modes](#modes)
- [How it proves that nothing changed](#how-it-proves-that-nothing-changed)
- [What it asks you](#what-it-asks-you)
- [The report](#the-report)
- [Languages and tools](#languages-and-tools)
- [Rules that it keeps](#rules-that-it-keeps)
- [Privacy](#privacy)
- [Limits](#limits)
- [Questions](#questions)
- [Files](#files)

## Why use it

Code that grows fast, or code that a model wrote, often has the same problems:

- the same helper in three files, with three names;
- functions of 200 lines with six levels of `if`;
- comments such as `// Step 1: loop over the users`, and banners such as `// ===== Helpers =====`;
- checks for values that can never be empty, and `try`/`catch` blocks that only log and throw again;
- names such as `data`, `result`, `temp` and `handleClick2`;
- `console.log` and `print` lines left from debugging.

A cleanup by hand takes a long time, and a small mistake can break the program without anybody seeing it. TidyLint
does the cleanup in small steps that you can review, and it checks after each step that the program still does the
same thing.

## How a run works

```text
Start                          Passes (each one is a reviewable step)          Finish
-----                          --------------------------------------          ------
Find the stack and commands    1. Format and lint        -> checks + snapshot  Same checks, same snapshot
Run the checks (baseline)      2. Reusable modules       -> checks + snapshot  Look at changed screens
Take a behavior snapshot       3. Small blocks           -> checks + snapshot  Review the whole diff
Survey the code                4. Human-written          -> checks + snapshot  Report, then delete temp files
Show the plan -> you approve   5. Comments               -> checks + snapshot
```

1. **Start.** TidyLint reads the project guide (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md`). It finds
   the language, the framework and the commands for format, lint, type check, test and build. It runs every check and
   records the results as the baseline. It records the checks that already fail, and it does not fix them.
2. **Snapshot.** Before any change, it records what the program does from the outside, for example the HTML of each
   page or the output of each command. See [How it proves that nothing changed](#how-it-proves-that-nothing-changed).
3. **Survey.** It lists the largest files, the longest functions, the deepest nesting, the repeated blocks, the dead
   code and the documents that copy code from the project.
4. **Plan.** It shows you the passes, the modules that it will make, merge or delete and the numbers from the
   survey. It makes no change before you approve the plan.
5. **Passes.** It does the five passes in a fixed order. After each pass, it runs the checks and the snapshot again
   and compares them with the baseline. If a result changes, it fixes the cause or undoes the pass.
6. **Finish.** It runs everything one last time, looks at the changed screens and asks a second agent (or a code
   review command) to read the whole diff only for behavior changes. Then it writes the report and deletes its
   temporary files.

## The five passes

The order is fixed, so that each pass is one diff that you can review. The mechanical formatter diff stays apart from
the real refactor.

### Pass 1: Format and lint

TidyLint runs the formatter and the linter of the project, then fixes the remaining errors by hand, one rule at a
time. It does not turn off a rule to make an error go away. If a rule is wrong for your project, it asks you.

If the project has no formatter or linter, TidyLint suggests the standard pair for the language (for example Prettier
and ESLint, or Ruff) and adds them only after you approve.

It also turns on the size rules of the linter as warnings, so that the linter lists the big blocks for pass 3. At the
end, it removes them again, unless you want to keep them.

After pass 1, the number of lines often goes up, sometimes a lot. This is not new code, and it is a good sign. Dense
code puts many statements, conditions or arguments on one long line. The formatter puts each one on its own line, with
standard indentation. The program does the same thing, but now a person can read it line by line, and a diff shows
each change clearly.

So TidyLint measures the code again after pass 1, and uses these numbers as "before" for the other passes.

### Pass 2: Reusable modules

TidyLint finds repeated code, markup, styles, queries, constants and types, and makes one shared module for each.
Every copy then uses the module, and the old copies are deleted.

Before:

```python
# report.py
def fmt(x):
    return "$" + format(round(x, 2), ".2f")

# low_stock.py
def fmt_money(x):
    return "$" + format(round(x, 2), ".2f")
```

After:

```python
# money.py
def money(value):
    return "$" + format(round(value, 2), ".2f")
```

- It puts each module where the project keeps that kind of thing, or in the usual place of the framework.
- It passes the project-specific data in as parameters, so that the module also works in another project. It makes a
  parameter only for data that differs between the current callers.
- It does not make a wrapper that only calls one function, or a "utils" file of unrelated parts.
- It deletes the code that becomes dead: old copies, unused exports, unused files and dead branches.

### Pass 3: Small blocks

TidyLint splits each block that is larger than these limits, unless the split makes it harder to read:

| Item | Limit |
| --- | --- |
| Function or method | 40 lines |
| File | 300 lines |
| Component markup (JSX, Svelte, Vue, HTML template, XAML) | 100 lines |
| Nesting depth | 3 levels |
| Parameters | 4 (one object for more) |
| Branches in one function (complexity) | 10 |

Each part does one job and has a name that says what it does. TidyLint does not cut a function into numbered parts
only to meet a limit. It uses early returns instead of deep nesting, and it turns long runs of near-identical lines
into a table and one loop.

Before:

```typescript
function shippingCost(order: Order) {
  if (order.items.length > 0) {
    if (order.country === 'US') {
      if (order.total < 100) {
        return 10;
      }
      return 0;
    }
    return 25;
  }
  return 0;
}
```

After:

```typescript
function shippingCost(order: Order) {
  if (order.items.length === 0) return 0;
  if (order.country !== 'US') return 25;
  return order.total < 100 ? 10 : 0;
}
```

### Pass 4: Human-written

TidyLint removes the signs of generated code:

- defensive code for states that cannot happen, such as a check after the type already guarantees the value;
- type annotations and casts that the compiler already infers, unless the project style wants them;
- generic names (`data`, `result`, `item`, `temp`, `helper`, `processData`), replaced with names from the domain of
  the project (`pendingOrders`, `approveRefund`);
- unused options, flags and parameters "for later" and classes that only hold plain functions;
- leftover debug output, emoji in code or logs and log messages for normal steps;
- mixed styles for the same job. The pattern that most of the project uses wins.

Before it removes a check, TidyLint finds where the value comes from. Data from files, users, the network or a
database can reach states that look impossible. That check stays, with a comment that says which input reaches it.

Debug output that reaches a person or a tool (for example a `print` to `stdout`) is behavior. TidyLint asks you before
it removes it.

### Pass 5: Comments

TidyLint deletes every comment that the code already says: banners, step comments, comments that read the code aloud,
doc comments that only repeat the parameter names, and commented-out code. A comment stays only if it gives:

- a reference: a link to a spec, an issue, a standard or library documentation;
- a reason that the code cannot show: a workaround for a bug (with the version), a platform limit, the source of a
  number or the meaning of a hard regular expression;
- a tool directive that the build needs (`eslint-disable-next-line`, `@ts-expect-error`, `# noqa`), with its reason;
- a marker that another tool reads, such as a snippet marker for a document;
- a license header, or the documentation of a public API.

Before:

```python
# ===================== Helpers =====================

# loop over the rows
for row in rows:
    # add the quantity
    total += int(row["qty"])
# old code
# for row in rows: print(row)
```

After:

```python
for row in rows:
    total += int(row["qty"])
```

## Modes

| Mode | Command in Claude Code | What it does |
| --- | --- | --- |
| Full | `/tidylint` or `/tidylint <folder>` | The start steps, all five passes and the finish |
| Check | `/tidylint check` | The survey and the plan only. It changes nothing. |
| Changed files | `/tidylint changed <commit>` | Only the files changed since `<commit>`, including new files |
| One pass | `/tidylint pass <1-5>` | The start steps, only that pass and the finish |

You can add folders or files to every mode, for example `/tidylint pass 5 src/api`. In other tools, say the same in
words, for example "Use TidyLint in check mode on the `src` folder".

- Use **check** to see the size of the work before you decide.
- Use **changed files** after a batch of features, to clean up only the new work.
- Use **one pass** when you want only one kind of change, for example only the comments.

## How it proves that nothing changed

TidyLint uses two kinds of proof, before and after each pass.

**1. The project's own checks.** The type check, the tests and the build must give the same results as the baseline.
A check that failed before the cleanup must fail in the same way after it, and the report lists it.

**2. A behavior snapshot.** Tests often cover only part of the code. So TidyLint records what the program does from the
outside, before the first change, and compares it after each pass:

| Project type | What the snapshot records |
| --- | --- |
| Web app with server pages | The HTML of every route, for each user role |
| Screens that render in the browser or app only (single-page apps, dialogs, menus, mobile and desktop apps) | Screenshots or the text of each screen, after the clicks that open it |
| API service | The status, the body and the headers that callers read, for each endpoint |
| Command-line tool | The output, the errors, the exit code and the files that it writes |
| Library | The public API: the exported names and their signatures |
| Scripts, data jobs, notebooks | The output files and the printed output |
| Games, graphics, hardware | A replay with a fixed seed, or screenshots of fixed scenes |

The snapshot uses the same data each time, and it includes error cases and edge inputs (a missing file, an empty
input, a row with missing fields). Before the compare, it removes the parts that change on every run: timestamps,
random IDs, tokens and the paths and line numbers in stack traces. The compare must show no difference, except the
changes that you approved.

**3. A review at the end.** A second agent, or the code review command of your tool, reads the whole diff only for
behavior changes and for the signs of generated code.

The details for each project type are in [references/proof.md](references/proof.md).

## What it asks you

TidyLint asks before each choice that is yours to make:

- whether to continue when the project has uncommitted changes (a commit first keeps the diffs apart);
- whether other projects or people use the code as a library or an API (if yes, the public names stay);
- whether to add a formatter, a linter or a tool that the project does not have;
- whether a linter rule that does not fit the project can change;
- whether to keep the size rules in the linter config after the run;
- whether to remove output that reaches a person or a tool, such as debug prints;
- whether to continue a run that stopped earlier;
- and, always, whether you approve the plan.

## The report

At the end, TidyLint writes a report with the same layout every time. "Before" for passes 2 to 5 is the measurement
after pass 1. If pass 1 adds lines, the report says why: the formatter split dense code into readable lines, and it
added no logic.

| Pass | Files changed | Lines before → after | Longest function before → after | Duplicates merged | Comments removed |
| --- | --- | --- | --- | --- | --- |
| 1. Format and lint | | | | - | - |
| 2. Reusable modules | | | | | - |
| 3. Small blocks | | | | - | - |
| 4. Human-written | | | | - | - |
| 5. Comments | | | | - | |

| Check | Before | After |
| --- | --- | --- |
| Each check of the baseline, and the snapshot | | |

Then it lists:

- what the snapshot compared, and what the proof did not cover;
- the checks that already failed before the cleanup;
- the documents and scripts that copy code and need a rebuild;
- what it could not verify;
- a suggested commit message for each pass.

## Languages and tools

TidyLint uses the tools that your project already has. If a tool is missing, it suggests the standard one below and
adds it only after you approve. [references/stacks.md](references/stacks.md) has the commands and the config for the
size rules.

| Language | Format | Lint and size rules | Dead code | Tested |
| --- | --- | --- | --- | --- |
| TypeScript, JavaScript | Prettier | ESLint 9 with `typescript-eslint` | knip | Yes, on samples and on one real project |
| Python | Ruff | Ruff | Ruff, vulture | Yes, on samples |
| Go | gofmt | go vet, golangci-lint | staticcheck | gofmt and go vet on a sample |
| Rust | cargo fmt | clippy | compiler warnings | clippy on a sample |
| C#, .NET | dotnet format | .NET analyzers, SonarAnalyzer | .NET analyzers | dotnet format, dotnet build and `CA1502` on a sample |
| Java | Spotless | Checkstyle | PMD | Not yet |
| Kotlin | ktlint | detekt | detekt | Not yet |
| PHP | PHP-CS-Fixer, Pint | PHPStan, PHPMD | - | Not yet |
| Ruby | RuboCop | RuboCop | - | Not yet |
| Swift | SwiftFormat | SwiftLint | - | Not yet |
| Dart, Flutter | dart format | dart analyze | - | Not yet |
| C, C++ | clang-format | clang-tidy | - | Not yet |
| CSS, HTML, SQL, shell | Prettier, sqlfluff, shfmt | Stylelint, sqlfluff, ShellCheck | - | Prettier only |

The duplicate search uses `jscpd`, which reads most languages. For a language that is not in the table, TidyLint uses
the official formatter of the language and its most used linter, and sets them to the same limits.

## Rules that it keeps

- It does not change behavior, visible text, routes, the API, the database schema or the file formats.
- It keeps the names that other tools read: snippet markers, region tags, test IDs, CSS classes that tests use,
  translation keys and public API names.
- When it renames something, it changes every caller and test in the same pass, and it also searches for the old name
  as a string (in templates, config, routes and docs).
- It edits code one change at a time, not with search-and-replace scripts.
- It makes no change before you approve the plan, and it asks before it adds a dependency, a config file or a tool.
- It does not commit, push or make a branch unless you ask.
- It adds no AI notes, prompts or files to your project.
- Your project's own guide wins over the skill. If they conflict, it follows your project and tells you.

## Privacy

- TidyLint remembers nothing about your project. It writes nothing about it in its own folder, in a memory file or
  anywhere outside the project and its temporary folder.
- Its temporary files (the baseline, the snapshot and the progress file) stay in the system temporary folder, in a
  folder called `tidylint-<project folder name>`. It deletes them at the end of the run.
- If a run stops in the middle, the progress file stays there, so that the next session can continue. It holds only
  the mode, the scope, the commands and the passes done.
- TidyLint itself makes no network calls. Only the tools that you approve (for example `npx` packages) download
  anything.

## Limits

| Limit | What TidyLint does about it |
| --- | --- |
| The proof is only as good as the checks and the snapshot. | It takes a snapshot with edge cases, and the report names the paths that the proof did not reach. |
| The snapshot does not measure speed or memory use. | If they matter, use your project's own benchmark before and after. |
| Behavior that depends on outside services is hard to record. | It records it only with your project's own mocks or test accounts, and reports the rest. |
| A big project does not fit in one session. | It works one folder at a time and keeps a progress file, so that another session can continue. |
| The duplicate search needs `jscpd`. | It asks once to use it. Without it, the search is weaker, and the report says so. |
| Many stacks in the table are not tested yet. | Their commands follow the official docs of each tool. The "Tested" column shows what ran. |
| "Human-written" is a matter of judgment. | It follows a fixed list of signs, and a second review reads the diff. It does not promise that a tool or a person cannot tell that a model worked on the code. |

## Questions

**Does it change what my program does?** No. That is the main rule. Each pass is checked with your tests and a
behavior snapshot. If you approve a small change (for example, to remove a debug print), the report lists it.

**Will it rewrite my whole project at once?** No. It shows a plan first, and it works in five separate passes. You
can review and commit each pass on its own.

**My project has no tests. Can I use it?** Yes. The behavior snapshot is then the main proof, and TidyLint tells you
that at the start.

**Does it work without Claude Code?** Yes. Any agent that can read files, edit files and run shell commands can follow
[AGENTS.md](AGENTS.md) and [SKILL.md](SKILL.md).

**Does it add files to my project?** Only the formatter or linter config that you approve. The snapshot scripts and
the progress file stay in the system temporary folder.

**Can I keep the size rules in my linter?** Yes. The plan asks you. The default is to remove them at the end.

## Files

| File | For |
| --- | --- |
| [SKILL.md](SKILL.md) | The model: the rules, the modes, the start steps, the five passes and the report |
| [references/stacks.md](references/stacks.md) | The formatter, linter, size rules and dead-code finder for each language, and the commands that find the problems |
| [references/proof.md](references/proof.md) | The behavior snapshot for each project type |
| [SETUP.md](SETUP.md) | People: install, use, update and remove |
| [AGENTS.md](AGENTS.md) | Other agents: where to start |
| [LICENSE](LICENSE) | MIT |

## License

MIT. See [LICENSE](LICENSE).
