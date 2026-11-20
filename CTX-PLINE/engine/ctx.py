"""CTX-PLINE (Context Pipeline): deterministic, token-lean project memory for any AI agent or model.
Python 3 (tested on 3.14), stdlib only. Zero network calls, zero LLM calls.

Storage locations discovered automatically (walking up to repo root):
  1. Explicit --dir <path> or CTX_DIR environment variable
  2. .ctx/              (compact universal default)
  3. .context/          (context-memory standard)
  4. .agents/context/   (Antigravity / Agentic workspace standard)
  5. .claude/context/   (Claude Code standard)

Commands:
  load     Compile and print context: full, --focus "<query>", --slim, --index, or --since <N>
  show     Inspect specific item IDs (D-1, F-2..F-5) or sessions (s0014) without loading the digest
  find     Search open & closed items across all history (exact -> ranker -> built-in IDF/BM25 ranker)
  next     Show next session number, live items (token-lean on big projects), and entry format
  save     Record a session entry (--text "...", --file <path>, or stdin); supports X: A, B and F~1: updates
  status   Memory stats, token/char budget, and duplicate/stale item health check
  compile  Assign stable IDs, compress old sessions, update ledger.json, rebuild digest.md
  init     Initialize memory (--agents, --claude, --hooks claude,gemini, --instructions AGENTS.md, --merge)
  recall   Prompt hook: print the open D/F items that match the prompt (nothing when none match well)
  autosave SessionEnd fallback from transcript (Claude Code, Gemini CLI, Codex, or generic JSON/JSONL)
"""
import argparse, difflib, json, math, os, re, shlex, shutil, subprocess, sys
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CANDIDATE_DIRS = (
    Path(".ctx"),
    Path(".context"),
    Path(".agents") / "context",
    Path(".claude") / "context",
)
KEEP_FULL, KEEP_TOTAL = 2, 5   # newest 2 keep notes; sessions 3-5 keep main points; older pruned to ledger
CAP_CHARS = 8000               # digest budget (~2k tokens); live items are never cut from digest.md
CLOSED_WINDOW = 3              # closed items stay visible in digest for this many sessions
MAX_ENTRY = 4000               # characters per entry; entries stay light
KINDS = {"D": "Decisions", "F": "Facts", "T": "Open tasks", "I": "Known issues"}
HEAD = re.compile(r"^#\s*Session\s+\d+\s*(.*)$")
# Matches `D: text`, `D-3: text`, or inline supersede `D~3: text` / `D-3~: text`
TAG = re.compile(r"^(?:[-*]\s*)?([DFTI])(?:(-|\s*~)\s*(\d+))?(~)?\s*:\s*(.+)$")
# Matches single or multi-ID close: `X: T-1 done` or `X: F-2, F-5, T-3 reason`
CLOSE = re.compile(r"^(?:[-*]\s*)?X\s*:\s*([DFTI]-\d+(?:\s*[,;]\s*[DFTI]-\d+)*)\s*(.*)$")
ID_TOKEN = re.compile(r"[DFTI]-\d+")
MARKER = "<!-- CTX-PLINE -->"
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "into", "is", "it", "its",
    "not", "of", "on", "or", "so", "that", "the", "their", "then", "there", "these", "this", "to", "use", "used",
    "uses", "using", "was", "were", "when", "with", "without",
}
# recall only: chat and task words in a prompt are rare in items, so they got high weights and made false matches
PROMPT_STOPWORDS = STOPWORDS | set("""
    i me my mine we us our you your he she him her they them what which who whom whose why how where can could would
    should will shall may might must do does did done am been being had having if but because than too very also just
    only still again now here all any some no nor each every both about above after before between over under up down
    out off more most other such own same let lets please thanks thank ok okay yes yeah hi hello hey fix add make write
    run update change changed explain summarize show tell give get try want need look looks good great nice fine work
    works new latest cannot dont nothing something
""".split())

FORMAT_SHORT = """Summary: 1-2 sentences on what this session did.
D: decision + reason | F: fact | T: open task | I: issue
X: T-3, F-2 reason (close one or more IDs) | F~2: new fact (supersedes F-2 in one line)
## Notes
Up to 10 lines for the next session (kept 2 sessions, then dropped)."""


# ---------------------------------------------------------------- locating the memory folder

def is_memory_dir(p):
    return p.is_dir() and (
        (p / "sessions").is_dir() or (p / "ledger.json").is_file() or (p / "digest.md").is_file()
    )


def find_root(start=None, explicit=None):
    """Find the project's memory folder.
    Priority:
      1. explicit (--dir) or CTX_DIR env var
      2. HERE if running from an installed copy inside a memory folder (.ctx, .context, .agents/context, .claude/context)
      3. Walk up from start (or cwd) to repo root (.git), checking .ctx, .context, .agents/context, .claude/context
      4. Default for new setup: .agents/context if .agents exists, .claude/context if .claude exists, else .ctx
    """
    raw = explicit or os.environ.get("CTX_DIR")
    if raw:
        p = Path(raw).resolve()
        if is_memory_dir(p) or p.name in (".ctx", ".context", "context"):
            return p
        for rel in CANDIDATE_DIRS:
            if is_memory_dir(p / rel):
                return p / rel
        return p

    if is_memory_dir(HERE) and (
        HERE.name in (".ctx", ".context")
        or (HERE.name == "context" and HERE.parent.name in (".claude", ".agents"))
    ):
        return HERE

    cur = Path(start or Path.cwd()).resolve()
    home = Path.home().resolve()
    for d in (cur, *cur.parents):
        if d == home:
            break
        for rel in CANDIDATE_DIRS:
            cand = d / rel
            if is_memory_dir(cand):
                return cand
        if (d / ".git").exists() or d == d.parent:
            break

    for rel in CANDIDATE_DIRS:
        if (cur / rel).is_dir():
            return cur / rel
    return cur / ".ctx"


def root_dir(explicit_dir=None):
    """Compatibility alias for find_root."""
    return find_root(explicit=explicit_dir)


def project_of(root):
    root = Path(root).resolve()
    if root.name == "context" and root.parent.name in (".claude", ".agents"):
        return root.parent.parent
    return root.parent


def python_cmd():
    return "python" if os.name == "nt" or not shutil.which("python3") else "python3"


def script_ref(root):
    """How to call the project copy of this script from the project root, e.g. `python .ctx/ctx.py`."""
    root = Path(root).resolve()
    try:
        rel = (root / "ctx.py").relative_to(project_of(root)).as_posix()
    except ValueError:
        rel = (root / "ctx.py").as_posix()
    return f"{python_cmd()} {rel}"


# ---------------------------------------------------------------- session files

def parse(path):
    s = {"path": path, "num": int(path.stem), "head": "", "summary": "", "items": [], "closes": [], "notes": [],
         "compressed": False, "auto": False}
    in_notes = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if m := HEAD.match(line):
            s["head"], s["auto"] = m.group(1).strip(), "(auto)" in line
        elif line.strip() == "<!-- compressed -->":
            s["compressed"] = True
        elif line.lower().startswith("summary:"):
            s["summary"] = line.split(":", 1)[1].strip()
        elif line.strip().lower() == "## notes":
            in_notes = True
        elif in_notes:
            s["notes"].append(line)
        elif m := CLOSE.match(line.strip()):
            ids = ID_TOKEN.findall(m.group(1))
            why = m.group(2).strip()
            for iid in ids:
                s["closes"].append((iid, why))
            if len(ids) > 1:
                s["dirty"] = True
        elif m := TAG.match(line.strip()):
            kind, sep, num_s, tilde, text = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5).strip()
            is_supersede = (sep and "~" in sep) or bool(tilde)
            if is_supersede and num_s:
                old_id = f"{kind}-{int(num_s)}"
                s["closes"].append((old_id, f"superseded by new {kind} item"))
                s["items"].append([kind, None, text])
                s["dirty"] = True
            else:
                s["items"].append([kind, int(num_s) if num_s else None, text])
    return s


def render(s):
    out = [f"# Session {s['num']:04d} {s['head']}".rstrip()]
    if s["compressed"]:
        out.append("<!-- compressed -->")
    if s["summary"]:
        out.append(f"Summary: {s['summary']}")
    out.append("")
    out += [f"{k}-{n}: {t}" for k, n, t in s["items"]]
    out += [f"X: {i} {why}".rstrip() for i, why in s["closes"]]
    if not s["compressed"] and any(l.strip() for l in s["notes"]):
        out += ["", "## Notes", *s["notes"]]
    return "\n".join(out).rstrip() + "\n"


def session_files(root):
    sdir = Path(root) / "sessions"
    return sorted(sdir.glob("[0-9]*.md"), key=lambda p: int(p.stem)) if sdir.is_dir() else []


def read_ledger(root):
    led = Path(root) / "ledger.json"
    return json.loads(led.read_text(encoding="utf-8")) if led.exists() else {}


# ---------------------------------------------------------------- compile + digest

def compile_(root, saved_at=None):
    """Rebuild everything from sessions/ + ledger.json. Deterministic: no model calls, nothing dropped silently."""
    root = Path(root)
    sdir, led_path = root / "sessions", root / "ledger.json"
    sdir.mkdir(parents=True, exist_ok=True)
    sessions = [parse(p) for p in session_files(root)]
    on_disk = {s["num"] for s in sessions}
    old_doc = read_ledger(root)
    old, saved_at = old_doc.get("items", []), saved_at or old_doc.get("saved_at")
    items = {it["id"]: it for it in old if it["session"] not in on_disk}
    top = {k: 0 for k in KINDS}
    for iid in [*items, *(f"{k}-{n}" for s in sessions for k, n, _ in s["items"] if n)]:
        top[iid[0]] = max(top[iid[0]], int(iid[2:]))
    unknown = []
    for s in sessions:
        for it in s["items"]:
            if it[1] is None:
                top[it[0]] += 1
                it[1], s["dirty"] = top[it[0]], True
            iid = f"{it[0]}-{it[1]}"
            items[iid] = {"id": iid, "kind": it[0], "text": it[2], "session": s["num"], "status": "open"}
        for iid, why in s["closes"]:
            if iid in items:
                items[iid].update(status="closed", closed_in=s["num"], why=why)
            else:
                unknown.append(f"s{s['num']:04d} closes unknown {iid}")
    latest = sessions[-1]["num"] if sessions else 0
    kept = []
    for s in sessions:
        age = latest - s["num"]
        if age >= KEEP_TOTAL:
            s["path"].unlink()
            continue
        if age >= KEEP_FULL and not s["compressed"]:
            s["compressed"], s["dirty"] = True, True
        if s.get("dirty"):
            s["path"].write_text(render(s), encoding="utf-8", newline="\n")
        kept.append(s)
    doc = {"latest": latest, **({"saved_at": saved_at} if saved_at else {}),
           "items": sorted(items.values(), key=lambda i: (i["kind"], int(i["id"][2:])))}
    led_path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    text = digest(list(items.values()), kept, latest, unknown, script_ref(root))
    (root / "digest.md").write_text(text, encoding="utf-8", newline="\n")
    return text


def _session_block(s, include_notes=True):
    tag = " (auto, unreviewed)" if s["auto"] else ""
    line = f"- s{s['num']:04d}{tag}: {s['summary'] or '(no summary)'}"
    notes = [l for l in s["notes"] if l.strip()] if include_notes and not s["compressed"] else []
    return "\n".join([line, *("  " + l.strip() for l in notes)])


def digest(items, sessions, latest, unknown, ref="python .ctx/ctx.py"):
    head = [f"# Project context (from sessions up to {latest:04d}; next is {latest + 1:04d})",
            f"Saved with `{ref} save` at the end of a session; IDs like D-3 are stable. Close items with "
            f"`X: <ID>`. Focused/compact read: `{ref} load --focus <words>` or `--slim`. Search: `{ref} find <words>`."]
    live = []
    for k, title in KINDS.items():
        rows = [f"- {it['id']} {it['text']}" for it in items if it["kind"] == k and it["status"] == "open"]
        if rows:
            live += ["", f"## {title}", *rows]
    newest = sorted(sessions, key=lambda s: -s["num"])
    blocks = []
    for i, s in enumerate(newest):
        blocks.append(("recent", s["num"], _session_block(s, include_notes=i < KEEP_FULL)))
    closed = [it for it in items if it["status"] == "closed" and latest - it.get("closed_in", 0) < CLOSED_WINDOW]
    for it in sorted(closed, key=lambda i: -i["closed_in"]):
        blocks.append(("closed", 0, f"- {it['id']} {it['text']} (closed s{it['closed_in']:04d}: {it.get('why') or 'done'})"))
    size = len("\n".join(head + live))
    chosen = []
    for idx, b in enumerate(blocks):
        # Always keep at least the latest session summary so handoff continuity is never starved by old D/F items
        if size + len(b[2]) + 1 <= CAP_CHARS or (idx == 0 and b[0] == "recent"):
            chosen.append(b)
            size += len(b[2]) + 1
    out = head + live
    recent = sorted((b for b in chosen if b[0] == "recent"), key=lambda b: -b[1])
    if recent:
        out += ["", "## Recent sessions", *(b[2] for b in recent)]
    if any(b[0] == "closed" for b in chosen):
        out += ["", "## Recently closed", *(b[2] for b in chosen if b[0] == "closed")]
    if size > CAP_CHARS:
        out += ["", "! Context is over budget: close or merge items with /save (or read with `load --focus <topic>` / `load --slim`)."]
    if unknown:
        out += ["", "! " + "; ".join(unknown)]
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- IDF / BM25-lite scoring & duplicate detection

def _tokens(text):
    return [t for t in re.findall(r"[a-z0-9]{2,}", text.lower()) if t not in STOPWORDS]


def _stem(w):
    for suf in ("ing", "tion", "ions", "ed", "es", "s"):
        if len(w) > len(suf) + 2 and w.endswith(suf):
            return w[:-len(suf)]
    return w


def _prefix_match(q, t):
    """True when one word is a clear prefix/abbreviation of the other (e.g. 'auth' -> 'authentication', 'indent' -> 'indentation')."""
    if len(q) >= 4 and len(t) >= len(q) + 2 and t.startswith(q):
        return True
    return min(len(q), len(t)) >= 5 and t[:5] == q[:5]


def score_items(items, query_words, top=5, min_terms=1):
    """Zero-dependency IDF-weighted token + stem + fuzzy scorer over items.
    min_terms: an item must match at least this many different query words (capped at the query size)."""
    q_raw = [w.lower() for w in query_words if w.strip()]
    q_toks = _tokens(" ".join(q_raw)) or [re.sub(r"[^a-z0-9]", "", w) for w in q_raw if w]
    q_toks = list(dict.fromkeys(w for w in q_toks if w))  # a repeated word must not count twice (scores went over 1)
    min_terms = min(min_terms, len(q_toks))
    if not q_toks or not items:
        return []

    docs = []
    df = {q: 0 for q in q_toks}
    for it in items:
        raw = f"{it['id']} {it['text']} {it.get('why', '')}".lower()
        toks = re.findall(r"[a-z0-9]+", raw)
        stems = {_stem(t) for t in toks}
        docs.append((it, raw, toks, stems))
        for q in q_toks:
            qs = _stem(q)
            if q in toks or qs in stems or any(_prefix_match(q, t) for t in toks):
                df[q] += 1

    n_docs = len(items)
    # Normalize so a query where every term matches gets 0.80..1.00
    weights = {q: math.log(1.0 + (n_docs + 1.0) / (df[q] + 0.5)) for q in q_toks}
    total_w = sum(weights.values()) or 1.0

    scored = []
    for it, raw, toks, stems in docs:
        acc, matched = 0.0, 0
        for q in q_toks:
            qs = _stem(q)
            if q in toks or q == it["id"].lower():
                best = 1.0
            elif qs in stems and len(qs) >= 3:
                best = 0.88
            elif any(_prefix_match(q, t) for t in toks):
                best = 0.80
            elif len(q) >= 6:
                best = max((difflib.SequenceMatcher(None, q, t).ratio() for t in toks if len(t) >= 6), default=0.0)
                if best < 0.80:
                    best = 0.0
            else:
                best = 0.0
            acc += weights[q] * best
            matched += best > 0
        norm = acc / total_w
        if norm > 0 and matched >= min_terms:
            scored.append((norm, it))

    scored.sort(key=lambda x: (-round(x[0], 4), x[1]["status"] != "open", -x[1]["session"]))
    return scored[:top]


def find_similar_open(items, threshold=0.52):
    """Detect pairs of open items of the same kind that look like duplicates or unclosed updates."""
    open_items = [it for it in items if it.get("status") == "open"]
    by_kind = {}
    for it in open_items:
        by_kind.setdefault(it["kind"], []).append(it)
    pairs = []
    for kind, group in by_kind.items():
        tok_sets = [(it, {_stem(t) for t in _tokens(it["text"]) if not t.isdigit()}) for it in group]
        for i in range(len(tok_sets)):
            it_a, set_a = tok_sets[i]
            if len(set_a) < 3:
                continue
            for j in range(i + 1, len(tok_sets)):
                it_b, set_b = tok_sets[j]
                if len(set_b) < 3:
                    continue
                inter = len(set_a & set_b)
                union = len(set_a | set_b)
                sim = inter / union if union else 0.0
                if sim >= threshold and inter >= 3:
                    newer, older = (it_b, it_a) if int(it_b["id"][2:]) > int(it_a["id"][2:]) else (it_a, it_b)
                    pairs.append((sim, newer, older))
    pairs.sort(key=lambda x: -x[0])
    return pairs


# ---------------------------------------------------------------- token-lean reading modes (load / show)

def _short(text, limit=110):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def render_focused(root, items, sessions, latest, focus_words, budget=CAP_CHARS):
    """Task-focused digest: all open T/I + latest 2 sessions + relevant D/F items for `focus_words`."""
    ref = script_ref(root)
    open_items = [it for it in items if it["status"] == "open"]
    tasks_issues = [it for it in open_items if it["kind"] in ("T", "I")]
    df_items = [it for it in open_items if it["kind"] in ("D", "F")]

    q_words = re.findall(r"[A-Za-z0-9_.-]+", " ".join(focus_words))
    ranked = score_items(df_items, q_words, top=25)
    matched_ids = {it["id"] for score, it in ranked if score >= 0.25}

    kept_df = [it for it in df_items if it["id"] in matched_ids]
    omitted_df = len(df_items) - len(kept_df)

    out = [f"# Focused context for '{' '.join(focus_words)}' (s{latest:04d}; {len(kept_df)}/{len(df_items)} D/F shown)",
           f"Close with `X: <ID> <why>`. Inspect any item: `{ref} show <ID>`. Full digest: `{ref} load`."]
    for k in ("T", "I", "D", "F"):
        pool = tasks_issues if k in ("T", "I") else kept_df
        rows = [f"- {it['id']} {it['text']}" for it in pool if it["kind"] == k]
        if rows:
            out += ["", f"## {KINDS[k]}", *rows]
    if omitted_df:
        out += ["", f"_(+{omitted_df} unrelated D/F items omitted; `{ref} find <words>` or `{ref} load` for all)_"]
    newest = sorted(sessions, key=lambda s: -s["num"])[:KEEP_FULL]
    if newest:
        out += ["", "## Recent sessions", *(_session_block(s, include_notes=True) for s in newest)]
    return "\n".join(out) + "\n"


def render_slim(root, items, sessions, latest, max_df=30):
    """Compact digest (~60-75% fewer tokens): open T/I in full, latest 2 session summaries, recent/compact D/F."""
    ref = script_ref(root)
    open_items = [it for it in items if it["status"] == "open"]
    ti = [it for it in open_items if it["kind"] in ("T", "I")]
    df = [it for it in open_items if it["kind"] in ("D", "F")]
    if len(df) > max_df:
        recent_ids = {it["id"] for it in sorted(df, key=lambda i: (-i["session"], -int(i["id"][2:])))[:max_df]}
        shown_df = [it for it in df if it["id"] in recent_ids]
        omitted = len(df) - len(shown_df)
    else:
        shown_df, omitted = df, 0
    out = [f"# Slim context s{latest:04d} (next s{latest + 1:04d}) — `{ref} show <ID>` or `load --focus <topic>`"]
    for k in ("T", "I", "D", "F"):
        pool = ti if k in ("T", "I") else shown_df
        limit = 200 if k in ("T", "I") else 95
        rows = [f"- {it['id']} {_short(it['text'], limit)}" for it in pool if it["kind"] == k]
        if rows:
            out += [f"## {KINDS[k]}", *rows]
    if omitted:
        out.append(f"_(+{omitted} older D/F items; `{ref} find <words>` or `{ref} load` for all)_")
    newest = sorted(sessions, key=lambda s: -s["num"])[:KEEP_FULL]
    if newest:
        out += ["## Recent sessions", *(f"- s{s['num']:04d}: {_short(s['summary'] or '(no summary)', 120)}" for s in newest)]
    return "\n".join(out) + "\n"


def render_index(root, items, sessions, latest):
    """Ultra-compact (~100-250 tokens) index: open T/I in full, latest session, D/F counts & top topics."""
    ref = script_ref(root)
    open_items = [it for it in items if it["status"] == "open"]
    counts = {k: sum(1 for it in open_items if it["kind"] == k) for k in KINDS}
    out = [
        f"# Context index s{latest:04d} (open: {counts['D']}D, {counts['F']}F, {counts['T']}T, {counts['I']}I)",
        f"Read relevant items: `{ref} load --focus <topic>` | `{ref} find <words>` | `{ref} show <ID>`",
    ]
    for k in ("T", "I"):
        rows = [f"- {it['id']} {it['text']}" for it in open_items if it["kind"] == k]
        if rows:
            out += [f"## {KINDS[k]}", *rows]
    newest = sorted(sessions, key=lambda s: -s["num"])[:1]
    if newest:
        out += ["## Latest session", _session_block(newest[0], include_notes=True)]
    return "\n".join(out) + "\n"


def render_delta(root, items, sessions, latest, since_num):
    """Delta view: only what was added or closed after session `since_num`."""
    if since_num >= latest:
        return f"Context unchanged since s{since_num:04d} (latest is s{latest:04d}).\n"
    new_open = [it for it in items if it["status"] == "open" and it["session"] > since_num]
    newly_closed = [it for it in items if it["status"] == "closed" and it.get("closed_in", 0) > since_num]
    new_sess = [s for s in sorted(sessions, key=lambda s: -s["num"]) if s["num"] > since_num]
    out = [f"# Context delta s{since_num:04d}..s{latest:04d}"]
    for k, title in KINDS.items():
        rows = [f"- {it['id']} (s{it['session']:04d}) {it['text']}" for it in new_open if it["kind"] == k]
        if rows:
            out += [f"## New {title}", *rows]
    if newly_closed:
        out += ["## Closed since s{:04d}".format(since_num),
                *(f"- {it['id']} (closed s{it['closed_in']:04d}: {it.get('why') or 'done'})" for it in newly_closed)]
    if new_sess:
        out += ["## Sessions", *(_session_block(s, include_notes=True) for s in new_sess)]
    return "\n".join(out) + "\n"


def show(root, targets):
    """Inspect specific item IDs (D-1, F-2..F-5) or sessions (s0014 / 0014) without loading the full digest."""
    root = Path(root)
    items = {it["id"].upper(): it for it in read_ledger(root).get("items", [])}
    sdir = root / "sessions"
    expanded = []
    for t in targets:
        for part in t.split(","):
            part = part.strip()
            if not part:
                continue
            if m := re.match(r"^([DFTI])-(\d+)\.\.\1?-?(\d+)$", part, re.I):
                k, a, b = m.group(1).upper(), int(m.group(2)), int(m.group(3))
                expanded.extend(f"{k}-{n}" for n in range(min(a, b), max(a, b) + 1))
            else:
                expanded.append(part)

    found = 0
    for tok in expanded:
        up = tok.upper()
        if up in items:
            it = items[up]
            print(f"{it['id']} [{state_of(it)}] (s{it['session']:04d}) {it['text']}")
            found += 1
        elif m := re.match(r"^S?0*(\d+)$", up):
            num = int(m.group(1))
            sp = sdir / f"{num:04d}.md"
            if sp.exists():
                print(sp.read_text(encoding="utf-8").rstrip())
                found += 1
            else:
                sess_items = [it for it in items.values() if it["session"] == num or it.get("closed_in") == num]
                if sess_items:
                    print(f"# Session {num:04d} (pruned from disk; reconstructed from ledger)")
                    for it in sess_items:
                        print(f"- {it['id']} [{state_of(it)}] {it['text']}")
                    found += 1
                else:
                    print(f"ctx show: session {num:04d} not found", file=sys.stderr)
        else:
            print(f"ctx show: '{tok}' not found", file=sys.stderr)
    return found


# ---------------------------------------------------------------- find

def state_of(it):
    return "open" if it["status"] == "open" else f"closed s{it['closed_in']:04d}: {it.get('why') or 'done'}"


def find(root, words, status_filter=None, kind_filter=None, top=5):
    """Search every item ever recorded (open, closed, from dropped sessions) without loading the ledger into context."""
    items = read_ledger(root).get("items", [])
    if status_filter:
        items = [it for it in items if it.get("status") == status_filter]
    if kind_filter:
        kinds = {k.strip().upper() for k in kind_filter.split(",") if k.strip()}
        items = [it for it in items if it.get("kind") in kinds]

    terms = [w.lower() for w in words if w.strip()]
    hits = [it for it in items if all(t in f"{it['id']} {it['text']} {it.get('why', '')}".lower() for t in terms)]
    for it in sorted(hits, key=lambda i: (i["status"] != "open", -i["session"])):
        print(f"{it['id']} [{state_of(it)}] (s{it['session']:04d}) {it['text']}")
    print(f"ctx find: {len(hits)} of {len(items)} items match", file=sys.stderr)
    if not hits and terms and items:
        hits = find_by_meaning(items, words, top=top) or find_fuzzy(items, words, top=top)
    return hits


def ranker_cmd():
    """Optional external ranker command from CTX_RANKER: question as the last argument, items on stdin,
    "score<TAB>item" lines out, best first. None when it is not set."""
    if not os.environ.get("CTX_RANKER"):
        return None
    # Windows split keeps the quotes around a path with spaces; the program name must not have them.
    return [a.strip('"') for a in shlex.split(os.environ["CTX_RANKER"], posix=os.name != "nt")]


def find_by_meaning(items, words, cmd=None, top=5):
    cmd = cmd or ranker_cmd()
    if not cmd:
        return []
    by_line = {f"{it['id']} {it['text']}".replace("\n", " "): it for it in items}
    try:
        r = subprocess.run([*cmd, f"This item is about {' '.join(words)}."], input="\n".join(by_line),
                           capture_output=True, text=True, encoding="utf-8", timeout=300)
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"ctx find: ranker failed ({e}); using built-in ranker", file=sys.stderr)
        return []
    hits = [(score, by_line[line]) for score, _, line in (l.partition("\t") for l in r.stdout.splitlines())
            if line in by_line][:top]
    if r.returncode or not hits:
        print(f"ctx find: ranker failed: {r.stderr.strip()[-200:]}; using built-in ranker", file=sys.stderr)
        return []
    print("ctx find: no item has all the words; closest by meaning (ranker scores):", file=sys.stderr)
    for score, it in hits:
        print(f"{score} {it['id']} [{state_of(it)}] (s{it['session']:04d}) {it['text']}")
    return [it for _, it in hits]


def find_fuzzy(items, words, top=5):
    """Zero-dependency IDF-weighted token, stem, and fuzzy ranker."""
    hits = score_items(items, words, top=top)
    if not hits:
        print("ctx find: no close match either; try other words", file=sys.stderr)
        return []
    print("ctx find: no item has all the words; closest by word overlap:", file=sys.stderr)
    for s, it in hits:
        print(f"{s:.2f} {it['id']} [{state_of(it)}] (s{it['session']:04d}) {it['text']}")
    return [it for _, it in hits]


# ---------------------------------------------------------------- recall (prompt hook)

RECALL_TOP, RECALL_MIN = 6, 0.3  # shortcut: tuned on 20 labelled prompts over one 281-item ledger (reference/internals.md); measure again before a change


def recall_items(items, prompt, top=RECALL_TOP, min_score=RECALL_MIN):
    """Open D/F items that match the prompt, best first. T/I items are already in every load mode."""
    words = [w for w in re.findall(r"[a-z0-9]{2,}", prompt.lower()) if w not in PROMPT_STOPWORDS]
    if len(set(words)) < 2:  # only chat words ("thanks, looks good") or one topic word: too little to match on
        return []
    pool = [it for it in items if it["status"] == "open" and it["kind"] in ("D", "F")]
    # two matched words: one shared word ("session") gave a full score to every item that had it
    return [it for s, it in score_items(pool, words, top=top, min_terms=2) if s >= min_score]


def recall(root, prompt, hook=None, top=RECALL_TOP, min_score=RECALL_MIN):
    """Add only the context a prompt needs, so the start view can stay slim. Never fails the prompt."""
    try:
        hits = recall_items(read_ledger(root).get("items", []), prompt, top, min_score) if prompt.strip() else []
    except Exception as e:  # a broken ledger must never block the user's prompt
        print(f"ctx recall: skipped ({e})", file=sys.stderr)
        hits = []
    if hits:
        lines = [f"Project context that may apply to this prompt (open items; `{script_ref(root)} show <ID>` for more):",
                 *(f"- {it['id']} {it['text']}" for it in hits)]
        emit_context("\n".join(lines) + "\n", hook, PROMPT_EVENT.get(hook, "UserPromptSubmit"))
    elif hook in ("gemini", "codex"):
        print("{}")


# ---------------------------------------------------------------- load / next / save / status

def load(root, hook=None, mode="full", focus=None, since=None):
    root = Path(root)
    if not ((root / "sessions").is_dir() and session_files(root)):
        text = f"Project context: nothing saved yet. Run `{script_ref(root)} save` near the end of a session to record it."
        emit_context(text, hook)
        return
    full_text = compile_(root)
    if not focus and mode == "full" and since is None:
        emit_context(full_text, hook)
        return
    items = read_ledger(root).get("items", [])
    sessions = [parse(p) for p in session_files(root)]
    latest = sessions[-1]["num"] if sessions else 0
    if since is not None:
        text = render_delta(root, items, sessions, latest, since)
    elif focus:
        words = focus if isinstance(focus, list) else [focus]
        text = render_focused(root, items, sessions, latest, words)
    elif mode == "slim":
        text = render_slim(root, items, sessions, latest)
    elif mode == "index":
        text = render_index(root, items, sessions, latest)
    else:
        text = full_text
    emit_context(text, hook)


# the prompt-time hook event of each agent; Claude Code takes plain stdout
PROMPT_EVENT = {"gemini": "BeforeAgent", "codex": "UserPromptSubmit"}


def emit_context(text, hook, event="SessionStart"):
    if hook in ("gemini", "codex"):
        print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}}))
    else:
        print(text, end="" if text.endswith("\n") else "\n")


def next_(root, show_all=False, focus=None):
    root = Path(root)
    files = session_files(root)
    last = parse(files[-1]) if files else None
    n = last["num"] + 1 if last else 1
    if last and last["auto"]:
        print(f"The latest entry {last['path'].name} was auto-recorded: your entry replaces it, so cover that session too.")
        n = last["num"]
    ref = script_ref(root)
    print(f"Save as session {n:04d}: `{ref} save --file <path>`, `{ref} save --text \"...\"`, or pipe stdin to `{ref} save`.")
    items = read_ledger(root).get("items", [])
    live = [it for it in items if it["status"] == "open"]
    if not live:
        print("No live items yet.")
    else:
        print("Live items (close with `X: <ID> <why>` or `X: ID1, ID2 <why>`; supersede in place with `F~1: new text`):")
        ti = [it for it in live if it["kind"] in ("T", "I")]
        df = [it for it in live if it["kind"] in ("D", "F")]
        for it in ti:
            print(f"- {it['id']} {it['text']}")
        if focus:
            words = focus if isinstance(focus, list) else [focus]
            ranked = [it for _, it in score_items(df, words, top=20)]
            for it in ranked:
                print(f"- {it['id']} {it['text']}")
            if len(df) > len(ranked):
                print(f"  (+{len(df) - len(ranked)} other D/F items; run `{ref} next --all` to list all)")
        elif show_all or len(df) <= 25:
            for it in df:
                print(f"- {it['id']} {it['text']}")
        else:
            # Token-lean mode for large ledgers (>25 D/F items): show newest 12 D/F + any duplicate candidates
            dups = find_similar_open(live)
            dup_ids = {x["id"] for _, a, b in dups[:4] for x in (a, b)}
            recent_df = sorted(df, key=lambda i: (-i["session"], -int(i["id"][2:])))[:12]
            shown_ids = {it["id"] for it in recent_df} | dup_ids
            for it in df:
                if it["id"] in shown_ids:
                    print(f"- {it['id']} {_short(it['text'], 110)}")
            omitted = len(df) - len(shown_ids)
            if omitted > 0:
                print(f"  (+{omitted} older D/F items; run `{ref} next --focus <words>` or `{ref} next --all` to list)")
        dups = find_similar_open(live)
        if dups:
            hints = [f"{a['id']}~{b['id']}" for _, a, b in dups[:4]]
            print(f"Hint — possible duplicate/superseded open items to close: {', '.join(hints)}")
    print(f"\nFormat (session {n:04d}, {date.today().isoformat()}):\n" + FORMAT_SHORT)


def _normalize_entry_text(text):
    """Unescape literal \\n sequences when an agent passes a single-line string via `save --text "Summary: ...\\nD: ..."`."""
    if "\n" not in text.strip() and "\\n" in text:
        text = text.replace("\\r\\n", "\n").replace("\\n", "\n")
    return text


def save(root, text):
    """Write a session entry. Only ever writes sessions/NNNN.md, then compiles."""
    root = Path(root)
    text = _normalize_entry_text(text)
    lines = [l for l in text.strip().splitlines() if not HEAD.match(l)]
    body = "\n".join(lines).strip()
    if not body:
        sys.exit("ctx save: empty entry")
    if len(body) > MAX_ENTRY:
        sys.exit(f"ctx save: entry is {len(body)} characters; keep it under {MAX_ENTRY} (tagged lines, short notes)")
    if not re.search(r"(?im)^(summary:|(?:[-*]\s*)?[DFTIX](?:[-~]\d+)?~?\s*:)", body):
        sys.exit("ctx save: no Summary: or tagged (D:/F:/T:/I:/X:) lines; see `ctx.py next` for the format")
    sdir = root / "sessions"
    sdir.mkdir(parents=True, exist_ok=True)
    existing = session_files(root)
    last = parse(existing[-1]) if existing else None
    n = last["num"] if last and last["auto"] else (last["num"] + 1 if last else 1)
    path = sdir / f"{n:04d}.md"
    path.write_text(f"# Session {n:04d} {date.today().isoformat()}\n{body}\n", encoding="utf-8", newline="\n")
    compile_(root, saved_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    saved_text = path.read_text(encoding="utf-8")
    ids = re.findall(r"^([DFTI]-\d+):", saved_text, re.M)
    print(f"ctx: saved {path.name}; new IDs: {', '.join(ids) or 'none'}")
    if ids:
        all_items = read_ledger(root).get("items", [])
        new_set = set(ids)
        dups = [(s, a, b) for s, a, b in find_similar_open(all_items) if a["id"] in new_set or b["id"] in new_set]
        for _, newer, older in dups[:3]:
            print(f"ctx hint: {newer['id']} looks similar to open {older['id']} (\"{_short(older['text'], 70)}\") "
                  f"— close superseded items with `X: {older['id']} <why>`")


def status(root):
    """Print project context summary, token budget, and duplicate/stale item health."""
    root = Path(root)
    sessions = session_files(root)
    items = read_ledger(root).get("items", [])
    open_items = [it for it in items if it.get("status") == "open"]
    closed_items = [it for it in items if it.get("status") == "closed"]
    digest_path = root / "digest.md"
    digest_size = len(digest_path.read_text(encoding="utf-8")) if digest_path.exists() else 0
    counts = {k: sum(1 for it in open_items if it.get("kind") == k) for k in KINDS}
    dups = find_similar_open(open_items)

    print(f"Context directory: {root}")
    print(f"Sessions on disk:  {len(sessions)}" + (f" ({sessions[0].stem}..{sessions[-1].stem})" if sessions else " (none)"))
    print(f"Ledger items:      {len(items)} total ({len(open_items)} open, {len(closed_items)} closed)")
    print(f"Open breakdown:    {counts['D']} decisions, {counts['F']} facts, {counts['T']} tasks, {counts['I']} issues")
    pct = (digest_size * 100 // CAP_CHARS) if CAP_CHARS else 0
    est_tokens = digest_size // 4
    print(f"Digest budget:     {digest_size} / {CAP_CHARS} chars ({pct}%, ~{est_tokens} tokens)")
    if dups:
        print(f"Health hint:       {len(dups)} similar open item pair(s) found (e.g. "
              + ", ".join(f"{a['id']}~{b['id']}" for _, a, b in dups[:4]) + ")")
    return {
        "root": str(root),
        "sessions": len(sessions),
        "total_items": len(items),
        "open_items": len(open_items),
        "closed_items": len(closed_items),
        "counts": counts,
        "digest_size": digest_size,
        "duplicates": [(a["id"], b["id"]) for _, a, b in dups],
    }


# ---------------------------------------------------------------- autosave (multi-agent transcript fallback)

EDIT_TOOL = re.compile(r"write|edit|replace|patch|create|notebook", re.I)
PATH_KEYS = ("file_path", "path", "notebook_path", "absolute_path", "filePath", "TargetFile", "target_file")


def _records(tp):
    raw = tp.read_text(encoding="utf-8", errors="replace")
    try:
        doc = json.loads(raw)
        if isinstance(doc, dict):
            meta = {k: doc[k] for k in ("startTime", "timestamp") if isinstance(doc.get(k), str)}
            doc = next((([meta] if meta else []) + doc[k] for k in ("messages", "history", "items", "turns")
                        if isinstance(doc.get(k), list)), [doc])
        if isinstance(doc, list):
            return [r for r in doc if isinstance(r, dict)]
    except json.JSONDecodeError:
        pass
    out = []
    for line in raw.splitlines():
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(r, dict):
            out.append(r)
    return out


def _text(c):
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(_text(p) for p in c)
    if isinstance(c, dict):
        return c.get("text") if isinstance(c.get("text"), str) else ""
    return ""


def _args(a):
    if isinstance(a, str):
        try:
            a = json.loads(a)
        except json.JSONDecodeError:
            return {}
    return a if isinstance(a, dict) else {}


def read_transcript(tp):
    prompts, files, last, start = [], [], "", None
    for e in _records(tp):
        start = start or e.get("timestamp") or e.get("ts") or e.get("startTime")
        p = e.get("payload") if isinstance(e.get("payload"), dict) else e
        m = p.get("message") if isinstance(p.get("message"), dict) else p
        role = str(m.get("role") or p.get("role") or e.get("type") or "").lower()
        c = m.get("content", m.get("parts", m.get("text")))
        calls = []
        if isinstance(c, list):
            if any(isinstance(x, dict) and x.get("type") == "tool_result" for x in c):
                continue
            calls += [x for x in c if isinstance(x, dict) and x.get("type") in ("tool_use", "function_call")]
        for k in ("toolCalls", "tool_calls", "functionCalls"):
            calls += [x for x in (m.get(k) or []) if isinstance(x, dict)]
        if p.get("type") == "function_call":
            calls.append(p)
        if role in ("user", "human"):
            t = _text(c)
            if t.strip() and not t.lstrip().startswith("<"):
                prompts.append(" ".join(t.split())[:160])
        elif role in ("assistant", "model", "gemini", "ai", "agent"):
            t = " ".join(_text(c).split())
            if t:
                last = t[:300]
        for call in calls:
            fn = call.get("function") if isinstance(call.get("function"), dict) else call
            name = str(fn.get("name") or "")
            args = _args(fn.get("input", fn.get("args", fn.get("arguments"))))
            f = next((args[k] for k in PATH_KEYS if isinstance(args.get(k), str)), None)
            if EDIT_TOOL.search(name) and f and f not in files:
                files.append(f)
    return start, prompts, files, last


def autosave(root, hook):
    root = Path(root)
    tp = Path(hook.get("transcript_path") or "")
    if not tp.is_file():
        return
    start, prompts, files, last = read_transcript(tp)
    if not prompts:
        return
    sdir = root / "sessions"
    sdir.mkdir(parents=True, exist_ok=True)
    existing = session_files(root)
    if existing:
        saved = read_ledger(root).get("saved_at")
        try:
            began = datetime.fromisoformat(str(start).replace("Z", "+00:00")).timestamp() if start else None
        except ValueError:
            began = None
        if began is None:
            began = tp.stat().st_ctime
        last_save = datetime.fromisoformat(saved).timestamp() if saved else existing[-1].stat().st_mtime
        if last_save >= began:
            return
    n = int(existing[-1].stem) + 1 if existing else 1
    cwd = Path(hook.get("cwd") or project_of(root))
    rel = []
    for f in files:
        try:
            rel.append(Path(f).relative_to(cwd).as_posix())
        except ValueError:
            rel.append(f)
    shown = prompts if len(prompts) <= 8 else prompts[:4] + ["..."] + prompts[-4:]
    body = [f"# Session {n:04d} {date.today().isoformat()} (auto)",
            f"Summary: Unreviewed auto-record ({len(prompts)} prompts, {len(files)} files changed); save to refine.",
            "", "## Notes", "Prompts:", *(f"- {p}" for p in shown)]
    if rel:
        body += ["Files changed:", *(f"- {f}" for f in rel[:15])]
    if last:
        body += [f"Last reply: {last}"]
    (sdir / f"{n:04d}.md").write_text("\n".join(body) + "\n", encoding="utf-8", newline="\n")
    compile_(root)


# ---------------------------------------------------------------- offer / decline (for launchers and a Claude Code start hook)

DECLINED = Path.home() / ".ctx-pline" / "declined.txt"
OFFER = ("Context memory (ctx) is not installed in this project. Before working on the request, ask the user once "
         "(AskUserQuestion: \"Add context memory to this project?\" with options Add it / Not now / Never for this "
         "folder). Add it: run `python \"{ctx}\" init --claude`; if it flags an existing .claude/settings.json, ask before "
         "re-running with --merge. Never: run `python \"{ctx}\" decline`. Not now: do nothing.")


def real_project(cwd):
    cwd, home = Path(cwd).resolve(), Path.home().resolve()
    if cwd == home or cwd.parent == cwd:
        return False
    skip = [home / "AppData", home / ".claude", Path(os.environ.get("SystemRoot", r"C:\Windows")),
            Path(os.environ.get("ProgramFiles", r"C:\Program Files"))]
    return not any(cwd.is_relative_to(s) for s in skip)


def should_offer(cwd):
    cwd = Path(cwd).resolve()
    if any(is_memory_dir(cwd / rel) or (cwd / rel / "ctx.py").exists() for rel in CANDIDATE_DIRS) or not real_project(cwd):
        return False
    declined = DECLINED.read_text(encoding="utf-8").splitlines() if DECLINED.exists() else []
    return str(cwd).lower() not in {d.strip().lower() for d in declined}


def decline(cwd):
    DECLINED.parent.mkdir(parents=True, exist_ok=True)
    with open(DECLINED, "a", encoding="utf-8") as f:
        f.write(str(Path(cwd).resolve()) + "\n")
    print(f"ctx: won't offer context memory in {Path(cwd).resolve()} again (remove from {DECLINED} to undo).")


# ---------------------------------------------------------------- init + wiring

README = """# Project context memory (CTX-PLINE — Context Pipeline)

Each session records what a future session needs; a new session starts by loading `digest.md` (~0-2k tokens),
or a task-focused slice (`ctx.py load --focus <words>` / `--slim` / `--index`).

## Commands
- `python ctx.py load [--focus <words> | --slim | --index | --since <N>]`
- `python ctx.py show <ID... | sNNNN>`
- `python ctx.py recall <task words>` (open decisions and facts that match a task; a prompt hook can run it)
- `python ctx.py find <words> [--open] [--closed] [--kind D,F]`
- `python ctx.py next [--all] [--focus <words>]`
- `python ctx.py save [--text "..." | --file draft.md]` (or stdin)
- `python ctx.py status`

## Tagged line format
- `D:` decision (with reason) · `F:` fact · `T:` open task · `I:` known issue
- `X: T-1, F-2 <why>` closes one or more items · `F~2: <new fact>` supersedes `F-2` in one line
- `Summary:` 1-2 sentences · `## Notes`: up to 10 lines for the next session (kept 2 sessions, then dropped)

Do not edit `digest.md` or `ledger.json` by hand; they are rebuilt. Edit `sessions/*.md`, then run `ctx.py compile`.
"""

SAVE_CMD = """---
description: Save this session's decisions, facts, tasks and issues to the project's context memory
---
Record this session in the project's context memory so future sessions start with it.

1. Run `{ref} next` and read the session number, live items, and format.
2. Compose the entry (`Summary:`, `D:`, `F:`, `T:`, `I:`, `X: <ID> <why>` or `F~<N>: <updated fact>`, and `## Notes`).
   If the latest entry was auto-recorded, your entry replaces it: cover that work too.
3. Save with `{ref} save <<'EOF'` ... `EOF` (or `--file` / `--text`), and report the new IDs in one line.
"""

INSTRUCTIONS = """{marker}
## Project memory (CTX-PLINE)
This project keeps session memory in `{dir}/`.
- Start of session: run `{ref} load --slim` (skip it if a hook already added "# Slim context" or "# Project context").
- Before each new task: run `{ref} recall <task words>` for the decisions and facts that apply (skip it if a hook
  already added "Project context that may apply to this prompt").
- Look up past items: `{ref} find <words>` or `{ref} show <ID>`.
- End of session / milestone: run `{ref} next`, then save with `{ref} save` (`--file`, `--text`, or stdin):
  `Summary:` + tagged lines `D:` decision · `F:` fact · `T:` task · `I:` issue · `X: ID1, ID2 <why>` · `F~N: updated fact`.
- Never edit `{dir}/digest.md` or `ledger.json` by hand.
{marker}
"""


def merge_json(path, apply, merge, flags, label):
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    probe = json.loads(json.dumps(data))
    if not apply(probe):
        return
    if path.exists() and not merge:
        flags.append(f"{path} exists; not changed. Re-run with --merge to add the {label} hooks.")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(probe, indent=2) + "\n", encoding="utf-8", newline="\n")


def add_hook(data, event, command, extra=None):
    groups = data.setdefault("hooks", {}).setdefault(event, [])
    # compare the commands, not the JSON text: JSON escapes the quotes in a command
    if any(h.get("command") == command for g in groups for h in g.get("hooks", [])):
        return False
    groups.append({**(extra or {}), "hooks": [{"type": "command", "command": command}]})
    return True


def hook_ref(ref, var):
    """The script call for a hook. Hooks run in the session's current folder, which can be a subfolder of the
    project, so a relative path failed there; the harness variable `var` holds the project folder."""
    py, _, rel = ref.partition(" ")
    return f'{py} "{rel}"' if Path(rel).is_absolute() else f'{py} "${var}/{rel}"'


def wire_claude(project, ref, merge, flags, write_cmd=False):
    if write_cmd:
        cmd = project / ".claude" / "commands" / "save.md"
        ours = SAVE_CMD.splitlines()[1]
        if cmd.exists() and ours not in cmd.read_text(encoding="utf-8"):
            flags.append(f"{cmd} already exists and differs; left unchanged.")
        else:
            cmd.parent.mkdir(parents=True, exist_ok=True)
            cmd.write_text(SAVE_CMD.format(ref=ref), encoding="utf-8", newline="\n")

    href = hook_ref(ref, "CLAUDE_PROJECT_DIR")

    def apply(d):
        changed = add_hook(d, "SessionStart", f"{href} load --slim")
        changed |= add_hook(d, "UserPromptSubmit", f"{href} recall")
        changed |= add_hook(d, "SessionEnd", f"{href} autosave --hook claude")
        allow = d.setdefault("permissions", {}).setdefault("allow", [])
        rule = f"Bash({ref} save*)"
        if rule not in allow:
            allow.append(rule)
            changed = True
        return changed

    merge_json(project / ".claude" / "settings.json", apply, merge, flags, "Claude Code")


def wire_gemini(project, ref, merge, flags):
    href = hook_ref(ref, "GEMINI_PROJECT_DIR")

    def apply(d):
        changed = add_hook(d, "SessionStart", f"{href} load --slim --hook gemini", {"matcher": "*"})
        changed |= add_hook(d, "BeforeAgent", f"{href} recall --hook gemini", {"matcher": "*"})
        return add_hook(d, "SessionEnd", f"{href} autosave --hook gemini", {"matcher": "*"}) or changed

    merge_json(project / ".gemini" / "settings.json", apply, merge, flags, "Gemini CLI")


def write_instructions(project, name, ref, dirname):
    path = project / name
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    block = INSTRUCTIONS.format(marker=MARKER, dir=dirname, ref=ref)
    if MARKER in text:
        text = re.sub(re.escape(MARKER) + r".*?" + re.escape(MARKER) + r"\n?", lambda _: block, text, flags=re.S)
    else:
        text = (text.rstrip() + "\n\n" if text.strip() else "") + block
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def init(project, merge=False, hooks=(), instructions=(), root=None, claude=False, agents=False):
    project = Path(project).resolve()
    if root is not None:
        root = Path(root).resolve()
    elif claude:
        root = project / ".claude" / "context"
    elif agents:
        root = project / ".agents" / "context"
    else:
        root = next((project / rel for rel in CANDIDATE_DIRS if is_memory_dir(project / rel)), project / ".ctx")

    (root / "sessions").mkdir(parents=True, exist_ok=True)
    if Path(__file__).resolve() != (root / "ctx.py").resolve():
        shutil.copyfile(__file__, root / "ctx.py")
    if not (root / "README.md").exists():
        (root / "README.md").write_text(README, encoding="utf-8", newline="\n")

    ref, flags = script_ref(root), []
    dirname = root.relative_to(project).as_posix() if root.is_relative_to(project) else str(root)
    hook_list = list(hooks)
    if claude and "claude" not in hook_list:
        hook_list.append("claude")

    wirers = {
        "claude": lambda p, r, m, fl: wire_claude(p, r, m, fl, write_cmd=claude or root.parent.name == ".claude"),
        "gemini": wire_gemini,
    }
    for h in hook_list:
        if h not in wirers:
            flags.append(f"no hook wiring for '{h}'; use --instructions AGENTS.md (see hooks/README.md in the skill)")
            continue
        wirers[h](project, ref, merge, flags)
    for name in instructions:
        write_instructions(project, name, ref, dirname)
    compile_(root)
    print(f"ctx: memory ready in {root}")
    print(f"ctx: start: {ref} load --slim   |   task: {ref} recall <words>   |   focused: {ref} load --focus <words>   |   end: {ref} save")
    for f in flags:
        print("ctx: FLAG: " + f)
    return 1 if flags else 0


# ---------------------------------------------------------------- CLI

def read_hook():
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except (json.JSONDecodeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def main(argv=None):
    for stream in (sys.stdout, sys.stdin, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(prog="ctx", description="CTX-PLINE (Context Pipeline): token-lean project memory.")
    ap.add_argument("cmd", choices=[
        "init", "load", "read", "show", "next", "save", "find", "status", "compile", "recall",
        "autosave", "offer", "should-offer", "decline",
    ])
    ap.add_argument("words", nargs="*", help="find/show/load --focus: query words or item IDs")
    ap.add_argument("--dir", help="memory folder (default: nearest .ctx, .context, .agents/context, or .claude/context)")
    ap.add_argument("--text", "-t", help="save: session entry text (supports literal \\n)")
    ap.add_argument("--file", "-f", help="save: read session entry from file")
    ap.add_argument("--focus", nargs="*", help="load/next: filter D/F items to those matching these words")
    ap.add_argument("--mode", choices=["full", "slim", "index", "delta"], default="full",
                    help="load: reading resolution (full, slim, index, delta)")
    ap.add_argument("--slim", action="store_true", help="load: shorthand for --mode slim (~50%% fewer tokens)")
    ap.add_argument("--index", action="store_true", help="load: shorthand for --mode index (~85%% fewer tokens)")
    ap.add_argument("--since", type=int, help="load: only show changes after session N")
    ap.add_argument("--all", dest="show_all", action="store_true", help="next: list all D/F items in full")
    ap.add_argument("--open", dest="open_only", action="store_true", help="find: only open items")
    ap.add_argument("--closed", dest="closed_only", action="store_true", help="find: only closed items")
    ap.add_argument("--kind", "-k", help="find: filter by kind (e.g. D,F)")
    ap.add_argument("--top", type=int, help="find/recall: max ranked results (find 5, recall 6)")
    ap.add_argument("--min-score", type=float, default=RECALL_MIN, help="recall: lowest match score to show (0..1)")
    ap.add_argument("--hook", choices=["claude", "gemini", "codex", "generic"],
                    help="load/autosave: hook output format")
    ap.add_argument("--transcript", help="autosave: transcript file path")
    ap.add_argument("--hooks", default="", help="init: comma list of agents to wire hooks for (claude,gemini)")
    ap.add_argument("--instructions", action="append", default=[],
                    help="init: add memory instructions block to file (AGENTS.md, GEMINI.md, CLAUDE.md)")
    ap.add_argument("--claude", action="store_true", help="init: use .claude/context + /save command + Claude hooks")
    ap.add_argument("--agents", action="store_true", help="init: use .agents/context")
    ap.add_argument("--merge", action="store_true", help="init: allow updating existing settings.json")
    a = ap.parse_args(argv)

    # Only autosave reads hook JSON from stdin so `load` never blocks if stdin stays open
    hook = read_hook() if a.cmd == "autosave" and not a.transcript else {}
    if a.transcript:
        hook["transcript_path"] = a.transcript
    start = hook.get("cwd") or os.environ.get("GEMINI_PROJECT_DIR") or os.environ.get("CLAUDE_PROJECT_DIR")

    if a.cmd == "init":
        project = Path(start or Path.cwd()).resolve()
        explicit_root = Path(a.dir).resolve() if a.dir else None
        hooks = [h.strip().lower() for h in a.hooks.split(",") if h.strip()]
        sys.exit(init(project, a.merge, hooks, a.instructions, explicit_root, claude=a.claude, agents=a.agents))

    root = find_root(start, a.dir)
    if a.cmd in ("load", "read"):
        mode = "slim" if a.slim else ("index" if a.index else a.mode)
        focus = (a.focus or []) + (a.words or []) if (a.focus is not None or a.cmd == "read") else None
        load(root, a.hook, mode=mode, focus=focus or None, since=a.since)
    elif a.cmd == "show":
        show(root, a.words)
    elif a.cmd == "next":
        focus = (a.focus or []) + (a.words or []) if a.focus is not None else (a.words or None)
        next_(root, show_all=a.show_all, focus=focus)
    elif a.cmd == "save":
        if a.text:
            save(root, a.text)
        elif a.file:
            save(root, Path(a.file).read_text(encoding="utf-8"))
        else:
            save(root, sys.stdin.read())
    elif a.cmd == "find":
        s_filter = "open" if a.open_only else ("closed" if a.closed_only else None)
        find(root, a.words, status_filter=s_filter, kind_filter=a.kind, top=a.top or 5)
    elif a.cmd == "recall":
        # words win; else the prompt from the hook JSON on stdin
        prompt = " ".join(a.words) if a.words else str(read_hook().get("prompt") or "")
        recall(root, prompt, a.hook, top=a.top or RECALL_TOP, min_score=a.min_score)
    elif a.cmd == "status":
        status(root)
    elif a.cmd == "compile":
        print(compile_(root), end="")
    elif a.cmd == "offer":
        if should_offer(Path.cwd()):
            print(OFFER.format(ctx=Path(__file__).resolve()))
    elif a.cmd == "should-offer":
        sys.exit(0 if should_offer(Path.cwd()) else 1)
    elif a.cmd == "decline":
        decline(Path.cwd())
    elif a.cmd == "autosave":
        if root.exists():
            autosave(root, hook)
        if a.hook in ("gemini", "codex"):
            print("{}")


if __name__ == "__main__":
    main()
