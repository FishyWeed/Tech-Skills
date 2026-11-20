# 4. End of a session or milestone: save

## Steps

1. Run `CTX next`. Add `--focus <words>` to show only the decisions and facts of the work you did, or `--all` for
   all of them in full.
2. Read the next session number and the live items. If `next` says the latest entry was auto-recorded, your entry
   replaces it, so cover that work too.
3. Write the entry with the tags below. Keep it under 4,000 characters.
4. Save it. Use one of these:
   - `CTX save --file entry.md`
   - `CTX save --text "Summary: ...\nD: ...\nX: T-1 done"` (the script turns a typed `\n` into a new line)
   - `CTX save` with the entry on stdin
5. Tell the user the session file and the new IDs in one line.

## Tags

| Tag | Meaning |
|---|---|
| `Summary:` | One or two sentences on the session. Required. |
| `D:` | A decision, with the reason |
| `F:` | A fact you checked |
| `T:` | An open task |
| `I:` | A known issue |
| `X: T-1 <why>` | Close an item that is done, wrong or replaced. `X: T-1, T-2, F-5 <why>` closes several. |
| `F~3: <new text>` | Replace `F-3`: it closes `F-3` and adds a new fact. `D~`, `T~` and `I~` work the same way. |
| `## Notes` | At most 10 lines of detail for the next session. Notes stay for two sessions. |

Do not give new items IDs. The script adds stable IDs when it compiles.

## Example

```markdown
Summary: Added dark mode and moved the API to a new port.

D: Keep the theme choice in localStorage because there is no account system yet
F~1: The API listens on port 8081
T: Detect the system theme
I: The toggle animation flickers in Safari 17
X: T-2, T-3 dark mode toggle and CSS variables done

## Notes
- The toggle component is in src/header.js
```

## Keep the memory clean

- If `save`, `next` or `status` prints a `Hint` about duplicate items (for example `F-48~F-43`), close the older
  item with `X:`.
- Record only what a future session needs. Do not record steps that led nowhere.

## If the session ends without a save

The end hook runs `CTX autosave`. It reads the session transcript and writes an entry marked `(auto)` with the
prompts, the changed files and the last reply. The next `save` replaces that entry. See [hooks/](../hooks/README.md).
