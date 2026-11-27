# Stacks: format, lint and size rules

Use the tools that the project already has. Suggest the tools below only if the project has none for that job, and
add them only after the user approves. The size rules match the limits in `SKILL.md` (pass 3).

## Find the problems

Run these from the project root, on the files in scope. They work in any POSIX shell (Git Bash on Windows).

| Problem | Command |
| --- | --- |
| Largest files | `git ls-files -- <scope> \| xargs wc -l \| sort -n \| tail -20` |
| Long functions, deep nesting, many parameters | The linter with the size rules below (warnings) |
| Large component markup | No common linter rule counts it. Read the largest component files. In `.svelte` and `.vue` files, count the lines outside `<script>` and `<style>`; in JSX, count the lines of the returned markup. |
| Repeated blocks | `jscpd --min-lines 6 --reporters console <scope>`. It reads most languages. If it is not installed, ask once before `npx jscpd` (it downloads a package). If the user says no, search for repeated lines, names and strings with `git grep`, and report that the search for duplicates was weak. `jscpd` misses blocks shorter than `--min-lines`: also look for small helpers with the same body under different names (format, parse, read, validate). |
| Dead code | The dead-code finder of the stack (see each stack below) |
| Comments | `git grep -n -E '^\s*(//\|#\|/\*\|\*\|--\|<!--)' -- <scope>` |
| Debug output | `git grep -n -E 'console\.(log\|debug)\|debugger\|^\s*print\(\|fmt\.Print\|println!\|dbg!\|System\.out\.print\|Console\.Write' -- <scope>` |
| Commented-out code | Read the comment lines from the search above; code in a comment has `;`, `(` or `=` in it. |
| Code that other files copy | `git grep -n -w -E 'region\|endregion\|snippet\|BEGIN\|END' -- <scope>` for common markers; also look for markers that the project's own docs use. For each large file, `git grep -n -F '<file name>' -- ':!<scope>'` finds the docs and scripts that read it. |

## TypeScript and JavaScript

- Format: Prettier. Lint: ESLint 9 (flat config) with `typescript-eslint`.
- Add for Svelte: `prettier-plugin-svelte`, `eslint-plugin-svelte`. For React: `eslint-plugin-react-hooks`.
  For Vue: `eslint-plugin-vue`. For Angular: `angular-eslint`.
- Commands: `npx prettier --write <scope>`, `npx eslint --fix <scope>`, then the type check (`tsc --noEmit`,
  `svelte-check` or `vue-tsc`).
- Dead code: `npx knip` (unused files, exports and dependencies). Ask before you add it. It can list config files
  (such as `eslint.config.js`) as unused files; those stay.

Size rules, in `eslint.config.js`:

```js
{
  rules: {
    'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-depth': ['warn', 3],
    'max-params': ['warn', 4],
    complexity: ['warn', 10],
  },
}
```

## Python

- Format and lint: Ruff (`ruff format`, `ruff check --fix`). Type check: the project's tool (`mypy` or `pyright`).
- Dead code: Ruff finds unused imports and variables (`F401`, `F841`). For unused functions and classes, `vulture
  <scope> --min-confidence 60`. Ask before you add it. At 60, it also lists functions that only other projects or a
  framework call; check each one by hand.

Size rules, in `pyproject.toml`:

```toml
[tool.ruff.lint]
extend-select = ["C901", "PLR0912", "PLR0913", "PLR0915"]

[tool.ruff.lint.mccabe]
max-complexity = 10

[tool.ruff.lint.pylint]
max-args = 4
max-branches = 10
max-statements = 40
max-nested-blocks = 3
```

The nesting rule (`PLR1702`) is a preview rule. Run it on its own in the survey, so that the project's config does not
turn on other preview rules: `ruff check --preview --select PLR1702 <scope>`. Ruff has no rule for file length. Use
the "Largest files" command.

## Go

- Format: `gofmt -w .` (or `goimports`). Lint: `go vet ./...`, and `golangci-lint run` if the project has it.
- Size rules in `.golangci.yml`: enable `funlen` (lines 40), `gocyclo` (min-complexity 10) and `nestif`.
- Dead code: `staticcheck ./...` (check `U1000`), or the `unused` linter of `golangci-lint`. `go vet` does not find
  unused functions.

## Rust

- Format: `cargo fmt`. Lint: `cargo clippy --fix`, then `cargo clippy`.
- Size rules in `clippy.toml`: `too-many-lines-threshold = 40`, `too-many-arguments-threshold = 4`,
  `cognitive-complexity-threshold = 10`. Turn on the two rules that are off by default:
  `cargo clippy -- -W clippy::too_many_lines -W clippy::cognitive_complexity`.
- Dead code: the compiler warns about it (`dead_code`); do not hide the warning with `#[allow(dead_code)]`.

## C# and .NET

- Format and lint: `dotnet format`. Set the rules in `.editorconfig`.
- Size rules: the built-in analyzers have `CA1502` (complexity). Turn it on in `.editorconfig`
  (`dotnet_diagnostic.CA1502.severity = warning`), and set the limit in a `CodeMetricsConfig.txt` file that the
  project lists as `AdditionalFiles`, with the line `CA1502: 10`. For length, nesting and parameters, use
  `SonarAnalyzer.CSharp` (`S138`, `S134`, `S107`) if the user approves; otherwise check them by hand.
- Dead code: `IDE0051` (unused private members) and `IDE0052` as warnings in `.editorconfig`. The build reports the
  `IDE` rules only with `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` in the project file. Then run
  `dotnet build`.

## Java

- Format: the project's build plugin (Spotless with google-java-format or palantir-java-format).
- Lint and size rules: Checkstyle with `MethodLength` (max 40), `FileLength` (max 300), `NestedIfDepth` and
  `NestedForDepth` (max 3), `ParameterNumber` (max 4) and `CyclomaticComplexity` (max 10).
- Dead code: PMD (`UnusedPrivateMethod`, `UnusedPrivateField`, `UnusedLocalVariable`).

## Kotlin

- Format and lint: ktlint, or detekt with its formatting rules.
- Size rules in the detekt config: `LongMethod`, `LargeClass`, `NestedBlockDepth`, `LongParameterList` and
  `CyclomaticComplexMethod`. Set them to the limits in `SKILL.md`. Read the detekt docs for each rule: some rules
  report at the threshold, not above it.
- Dead code: detekt `UnusedPrivateMember`, `UnusedPrivateProperty`.

## PHP

- Format: PHP-CS-Fixer or Laravel Pint. Lint: PHPStan or Psalm.
- Size rules: PHPMD (`ExcessiveMethodLength`, `ExcessiveClassLength`, `ExcessiveParameterList`,
  `CyclomaticComplexity`).

## Ruby

- Format and lint: RuboCop (`rubocop -a`).
- Size rules in `.rubocop.yml`: `Metrics/MethodLength` (Max 40), `Metrics/ClassLength` (Max 300),
  `Metrics/BlockNesting` (Max 3), `Metrics/ParameterLists` (Max 4), `Metrics/CyclomaticComplexity` (Max 10).

## Swift

- Format: SwiftFormat or `swift-format`. Lint: SwiftLint.
- Size rules in `.swiftlint.yml`: `function_body_length` (40), `file_length` (300), `nesting`,
  `function_parameter_count` (4), `cyclomatic_complexity` (10).

## Dart and Flutter

- Format: `dart format .`. Lint: `dart analyze` with `flutter_lints` or `lints`.
- The analyzer has no size rules. Use the "Largest files" command and the survey.

## C and C++

- Format: `clang-format`. Lint: `clang-tidy`.
- Size rules: `readability-function-size` (`LineThreshold: 40`, `NestingThreshold: 3`, `ParameterThreshold: 4`) and
  `readability-function-cognitive-complexity` (`Threshold: 10`).

## Styles, markup, SQL and shell

| Files | Format | Lint |
| --- | --- | --- |
| CSS, SCSS, Less | Prettier | Stylelint with `stylelint-config-standard` |
| HTML, Markdown, YAML, JSON | Prettier | - |
| SQL | `sqlfluff format` | `sqlfluff lint` (set the dialect of the project) |
| Shell scripts | `shfmt -w` | ShellCheck |

## Other stacks

Use the official formatter of the language and its most used linter. Find the settings for function length, nesting,
parameters and complexity, and set them to the limits in `SKILL.md`.
