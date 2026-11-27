# Internals: storage, compression, ranking and costs

A model does not need this file to use the skill. It is for people who change the engine.

## Storage

`ctx.py` looks for a memory folder from the current folder up to the repository root (`.git`), in this order:

1. `--dir <path>` or the `CTX_DIR` environment variable
2. `.ctx/` (the default)
3. `.context/`
4. `.agents/context/`
5. `.claude/context/`

```
.ctx/
  sessions/0012.md   one file per session: header, Summary, tagged lines, ## Notes
  digest.md          the compiled view, rebuilt on every load and compile
  ledger.json        the index of every item ever recorded; search it with find and show, never load it
  ctx.py             the project copy of engine/ctx.py
  README.md          short rules for people
```

To change a saved session, edit `sessions/*.md`, then run `ctx.py compile`. Never edit `digest.md` or
`ledger.json`: `compile` rebuilds them.

## Compression (no LLM tokens)

| Age of the session | On disk (`sessions/NNNN.md`) | In `digest.md` |
|---|---|---|
| Newest 2 | Full: `Summary`, tagged lines and `## Notes` | Summary and notes |
| 3 to 5 back | Marked `<!-- compressed -->`: notes removed, summary and tagged lines kept | One line, while the digest is under its limit |
| Older than 5 | File deleted | Open items stay in `digest.md`; all items stay in `ledger.json` |

- The digest limit is `CAP_CHARS` (8,000 characters). Open items are never cut, so a large project can go over it.
  `status` shows how far. Use `load --slim` or `load --focus` on such a project.
- The newest session summary and notes always stay in the digest, also when the project is over the limit.
- Closed items stay in the digest for `CLOSED_WINDOW` (3) sessions.

## Ranking

`find` first looks for items that have all the words. If none do, it tries the external ranker in `CTX_RANKER` (if
it is set), then the built-in ranker.

The built-in ranker (`score_items`) is used by `find`, `load --focus` and `recall`:

- Each query word has a weight `log(1 + (N + 1) / (df + 0.5))`, where `N` is the number of items and `df` is the
  number of items that have the word. Rare words count more.
- A word match scores 1.0, a stem match (`-ing`, `-tion`, `-ed`, `-es`, `-s` removed) 0.88 and a prefix match
  (`auth` and `authentication`) 0.80. Close spellings of 6 or more letters also count.
- The score is the weighted sum divided by the total weight, so it is from 0 to 1. A query whose words all match
  scores from 0.80 to 1.00.

A word that occurs two times in the query counts one time. Before this fix, such a query could score more than 1.

`recall` keeps the top 6 open decisions and facts that score 0.3 or more (`RECALL_TOP`, `RECALL_MIN`). Three
rules remove most noise:

1. It removes chat and task words (`PROMPT_STOPWORDS`: "can", "you", "my", "fix", "thanks", "good"...). These words
   are rare in items, so they got high weights and made false matches.
2. It prints nothing when fewer than 2 topic words are left.
3. Each item must match at least 2 different topic words (`score_items(..., min_terms=2)`). Before, one shared
   word such as "session" gave a full score to every item that had it.

Measured on a web-app project ledger (281 open decisions and facts) with 20 hand-labelled prompts (15 on topic and 5
off topic). The labels are strict, so some "noise" items apply in part:

| Version | Precision | Recall | Items printed for the 5 off-topic prompts |
|---|---|---|---|
| Before, min 0.3 | 0.46 | 0.37 | 4 |
| Before, min 0.4 | 0.63 | 0.27 | 1 |
| Now, min 0.3 | 0.51 | 0.47 | 0 |

A higher `RECALL_MIN` still does not separate good and bad items: 0.3 gave the best balance. Rule 3 can drop a good
item that has only one of the topic words. On a second project memory (132 items), "run the tests and commit" no
longer recalls a fact about the test results.

A fix was tested on the same 20 prompts (2026-11-21): also let in an item that matches one topic word, if few items
have that word (1, 2, 3 or 5 items), always or only when recall found fewer than 3 items. The best F1 went from 0.50
to 0.51, but every variant printed items for an off-topic prompt again: "write a short poem about rain" got a decision
about a "code rain" hero look. Rule 3 stays, because `recall` runs on every prompt and noise costs more than a missed
item, which `find` can still reach.

A cross-encoder ranker (gte-reranker-modernbert-base) was also tested on the 20 built-in candidates of each prompt.
It ordered items a little better, but it took about 4 seconds for each prompt, and its scores did not separate
either ("thanks, that looks good now" got 0.72). It also needs a large local install, so `recall` does not use it.

## Measured costs

Measured on one project memory (16 sessions, 132 items):

| Command | Tokens | Compared with the full load |
|---|---|---|
| `load` | about 4,600 | the full digest |
| `load --focus <words>` | about 600 | 87% less |
| `load --slim` | about 970 | 79% less |
| `load --since 15` | about 520 (about 5 when nothing changed) | 89% to 99% less |
| `load --index` | about 180 | 96% less |
| `show <IDs>` | about 25 to 150 | 97% less |
| `next` | about 680 (the old engine printed about 3,800) | 85% less |

On the web-app project memory from the recall test (292 open items), `load` is about 56,000 characters and
`load --slim` about 5,000.

### Share of a real session (2026-11-17)

Measured from the Claude Code logs of 9 sessions in 4 projects. The hook text (start view and recalls) is counted on
every later request: one cache write, then cache reads (price weight 0.1).

| Session | ctx share of the session cost |
|---|---|
| Normal work sessions (227 to 477 requests) | 0.1% |
| A long session (2,924 requests, start view added again after each restart and compaction) | 0.9% |
| One-prompt runs | 2% to 13% |
| All 9 sessions | 0.6% (0.8% at 3 characters per token, not 4) |

### With and without memory (2026-11-17)

Paid test on the same web-app project: 3 read-only questions (Node and Vercel versions, a new section kind, the
browser tests), 2 runs each, in two copies of the project: one with its memory and hooks, one without. Opus 5.5,
tools `Read`, `Grep` and `Glob` only.

| | Cost per question | Turns |
|---|---|---|
| With memory | $0.114 | 6.5 |
| Without memory | $0.160 | 9.2 |

- With memory, each question cost 29% less (17% to 37%), and this includes the start view and recalls.
- Quality was the same on two questions. On the Node question, only the runs with memory were right: without
  memory, the model read the lockfile's Node ranges and said that Node 23 cannot build the project. An install and
  `pnpm build` on Node 23.10 passed.
- A `/save` costs about $0.055 and is not in these numbers. All three questions had their answer in the memory, so
  a task that needs no history saves nothing.

## Origin

CTX-PLINE joins an older `ctx.py` and context-memory. It added the reading modes, `X: A, B` closes, `F~N:`
replacements, duplicate hints, the built-in ranker, `recall` and the fix that turns a typed `\n` in `save --text`
into a new line.
