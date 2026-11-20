# 3. During work: look up items

Never load `ledger.json` into your context. Use these commands:

```bash
CTX show D-10 D-26..D-29 s0014   # items, ranges of items or a session, also from sessions that are gone from disk
CTX find <words>                 # search all items, open and closed
CTX find <words> --open          # only open items
CTX find <words> --closed        # only closed items
CTX find --kind D,F <words>      # only some kinds (D, F, T, I)
CTX status                       # counts, the size of the digest and possible duplicate items
```

## How find ranks

1. Items that have all the words come first: open items before closed items, then the newest first.
2. If no item has all the words and the `CTX_RANKER` environment variable is set, `find` runs that command. It
   gets the question as its last argument and one item per line on stdin. It must print `score<TAB>item` lines,
   best first. Any local ranker that matches meaning can do this.
3. If `CTX_RANKER` is not set or fails, `find` uses the built-in ranker (word weight, word stems, prefixes and close
   spellings).

[reference/internals.md](../reference/internals.md) has the details of the ranker.
