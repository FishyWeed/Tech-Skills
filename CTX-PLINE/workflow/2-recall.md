# 2. Before a task: recall what applies

If a hook already added `Project context that may apply to this prompt`, skip this step.

```bash
CTX recall <words of the task>
```

`recall` prints the full text of the open decisions (`D-*`) and facts (`F-*`) that match the words, best first. It
prints nothing when no item matches well. Open tasks and issues are not in the result, because every load view
already shows them.

| Option | Default | Effect |
|---|---|---|
| `--top N` | 6 | The most items to print |
| `--min-score S` | 0.3 | The lowest match score to print, from 0 to 1 |
| `--hook gemini` or `--hook codex` | none | Print `hookSpecificOutput.additionalContext` JSON for that harness, and `{}` when nothing matches |

With no words, `recall` reads the prompt from hook JSON on stdin (the `prompt` field). That is how a prompt hook
runs it. See [hooks/](../hooks/README.md).

## Limits

- The ranker matches words, not meaning. Ignore items that do not apply to the task, and use `CTX find` for an
  item that you expect but do not see.
- `recall` ignores chat words such as "can you", "fix", "thanks" and "looks good". It needs at least two topic words
  in the prompt, and each item must match two of them. So a prompt with one topic word prints nothing.
- If recalls are often noisy, raise `--min-score`. Good matches can score as low as 0.3, so a higher value can
  also drop items that apply.
- `recall` never fails a prompt. If it cannot read the memory, it prints nothing and a note on stderr.
