# Proof: the behavior snapshot

The tests of a project often cover only part of the code. A behavior snapshot records what the program does from the
outside, before the cleanup, and compares it after each pass. Use the tools that the project already has. Ask before
you add a tool.

## How to take a snapshot

1. Take the first snapshot in "Start", before any change, from the current code. Then you do not need the old code
   again. If you need it later, use `git worktree add <tmp>/old HEAD`. Do not use `git stash`: it moves the user's
   uncommitted changes.
2. Include the error cases and the edge inputs, not only the normal case: a missing file, an empty input, a row with
   missing fields, values at the limits and a user with no rights.
3. Use the same data each time: the same database copy or seed, the same input files, a fixed random seed, a fixed
   clock or time zone where the project allows it, and the same environment variables.
4. Save each output as a file in `<tmp>/before/` or `<tmp>/after/`, with the same file name for the same case.
5. Normalize the parts that change on every run before you compare: timestamps, random IDs, session and CSRF tokens,
   hashes in asset file names, and whitespace. For HTML, also remove comments and write `<path/>` and `<path></path>`
   the same way. For error output, remove the file paths and line numbers of stack traces: they move when code moves,
   but the error type and message must stay.
6. Compare: `diff -r <tmp>/before <tmp>/after`. It must print nothing, except the changes that the user approved. If
   it prints another difference, find the cause. Fix the code, or show the user why the difference is not a change in
   behavior.
7. Keep the snapshot scripts in `<tmp>`. Put them in the project only if the user asks to keep them as tests.

## What to record for each project type

| Project type | Record | How |
| --- | --- | --- |
| Web app with server pages | The HTML of every route, for each user role that the app has | Start the dev server. List the routes from the router or the page files. `curl -s -b <cookie file> <url> > <tmp>/before/<route>.html` for each route. |
| Screens that render in the browser or app only (single-page apps, dialogs, menus, popups, mobile and desktop apps) | A screenshot or the text of the screen, after the clicks that open it | Use the project's end-to-end tool (Playwright, Cypress, Detox, Appium). If it has none, ask before you add one. Look at each pair of screenshots yourself. |
| API service | The status, the body and the headers that callers read, for each endpoint | `curl -s -i` with fixed requests. Sort the keys of JSON bodies before you compare them. |
| Command-line tool | The output, the errors, the exit code and the files that it writes | Run each command with fixed input files. Save `stdout`, `stderr` and `$?` for each run. |
| Library | The public API: the exported names and their signatures | The project's API tool if it has one. Else: TypeScript `tsc --declaration --emitDeclarationOnly --outDir <tmp>/before`; Python a script that prints `inspect.signature` of each public name; Go `go doc -all ./...`; Rust `cargo public-api` (ask before you install it); .NET or Java the public members by reflection. Run the tests too. |
| Scripts, data jobs, notebooks | The output files and the printed output | Run on a small fixed input. Compare the files, or their hashes: `sha256sum`. |
| Games, graphics, hardware | A replay with a fixed seed, or screenshots of fixed scenes | If the project cannot replay, tell the user what the proof does not cover. |

A project can have more than one type, for example a web app with an API. Record each type that it has.

## What the snapshot does not prove

- Timing, speed and memory use. If they matter, measure them with the project's own benchmark.
- Paths that the snapshot did not reach. Name them in the report.
- Behavior that depends on outside services. Record it only with the project's own mocks or test accounts.
