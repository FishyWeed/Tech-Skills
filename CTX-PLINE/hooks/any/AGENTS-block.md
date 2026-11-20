<!-- CTX-PLINE -->
## Project memory (CTX-PLINE)
This project keeps session memory in `.ctx/`.
- Start of session: run `python .ctx/ctx.py load --slim` (skip it if a hook already added "# Slim context" or "# Project context").
- Before each new task: run `python .ctx/ctx.py recall <task words>` for the decisions and facts that apply (skip it if a hook
  already added "Project context that may apply to this prompt").
- Look up past items: `python .ctx/ctx.py find <words>` or `python .ctx/ctx.py show <ID>`.
- End of session / milestone: run `python .ctx/ctx.py next`, then save with `python .ctx/ctx.py save` (`--file`, `--text`, or stdin):
  `Summary:` + tagged lines `D:` decision · `F:` fact · `T:` task · `I:` issue · `X: ID1, ID2 <why>` · `F~N: updated fact`.
- Never edit `.ctx/digest.md` or `ledger.json` by hand.
<!-- CTX-PLINE -->
