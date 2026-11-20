"""Offline tests for CTX-PLINE (Context Pipeline) (no network, no API calls): python -m unittest discover CTX-PLINE/tests"""
import contextlib, io, json, os, sys, tempfile, unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
SCRIPTS = Path(__file__).resolve().parent.parent / "engine"
sys.path.insert(0, str(SCRIPTS))
import ctx  # noqa: E402


def quiet(fn, *args, **kw):
    with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()):
        result = fn(*args, **kw)
    return result, out.getvalue()


def session(sdir, n, body):
    (sdir / f"{n:04d}.md").write_text(f"# Session {n:04d} 2026-01-0{n % 10}\nSummary: s{n}\n\n{body}\n", encoding="utf-8")


class Base(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.d = Path(self._tmp.name).resolve()
        self.root = self.d / ".ctx"
        self.sdir = self.root / "sessions"
        self.sdir.mkdir(parents=True)

    def tearDown(self):
        self._tmp.cleanup()

    def transcript(self, records, name="t.jsonl"):
        tp = self.d / name
        tp.write_text("\n".join(json.dumps(r) for r in records) + "\n", encoding="utf-8")
        return tp


class Memory(Base):
    def test_compile_compress_and_ids(self):
        entries = {1: "D: Use SQLite (single user)\nF: API port is 8080\nT: Add CSV export\n\n## Notes\nlong detail",
                   2: "T: Add login\nI: Safari layout bug", 3: "X: F-1 port moved\nF: API port is 8081",
                   4: "X: T-2 done", 5: "F: Deploys go to Fly.io", 6: "T: Write docs", 7: "X: I-1 fixed"}
        for n, body in entries.items():
            session(self.sdir, n, body)
            text = ctx.compile_(self.root)
        section = lambda name: text.split(f"## {name}\n")[1].split("\n\n")[0]
        self.assertEqual(sorted(p.stem for p in self.sdir.glob("*.md")), ["0003", "0004", "0005", "0006", "0007"])
        self.assertIn("<!-- compressed -->", (self.sdir / "0003.md").read_text())
        self.assertNotIn("<!-- compressed -->", (self.sdir / "0006.md").read_text())
        for live in ("D-1 Use SQLite", "F-2 API port is 8081", "T-1 Add CSV export", "F-3 Deploys go to Fly.io"):
            self.assertIn(live, text)
        self.assertNotIn("8080", section("Facts"))
        self.assertNotIn("T-2", section("Open tasks"))
        self.assertIn("I-1 Safari layout bug (closed s0007: fixed)", text)
        self.assertIn("python .ctx/ctx.py find" if os.name == "nt" else ".ctx/ctx.py find", text)
        led = {i["id"]: i for i in json.loads((self.root / "ledger.json").read_text())["items"]}
        self.assertEqual(len(led), 8)
        self.assertEqual((led["F-1"]["status"], led["F-1"]["closed_in"]), ("closed", 3))

    def test_budget_never_cuts_live_items_and_keeps_latest_session(self):
        session(self.sdir, 1, "\n".join(f"F: fact number {i:03d} " + "x" * 70 for i in range(120)) + "\nX: T-99 none")
        text = ctx.compile_(self.root)
        self.assertEqual(sum(f"fact number {i:03d}" in text for i in range(120)), 120)
        self.assertIn("## Recent sessions\n- s0001: s1", text)
        self.assertIn("over budget", text)
        self.assertIn("closes unknown T-99", text)

    def test_save_validates_replaces_auto_and_supports_inline_supersede_and_multi_close(self):
        with self.assertRaises(SystemExit):
            ctx.save(self.root, "just some prose")
        with self.assertRaises(SystemExit):
            ctx.save(self.root, "Summary: " + "x" * 5000)
        quiet(ctx.save, self.root, "Summary: first\nT: Ship it\nT: Write docs\nF: API port is 8080")
        (self.sdir / "0002.md").write_text("# Session 0002 2026-01-01 (auto)\nSummary: auto\n", encoding="utf-8")
        # Multi-ID close (X: T-1, T-2) + inline supersede (F~1: API port is 9090)
        _, out = quiet(ctx.save, self.root, "# Session 9999 ignored\nSummary: real\nD: Tabs\nX: T-1, T-2 shipped\nF~1: API port is 9090")
        self.assertIn("D-1", out)
        self.assertIn("F-2", out)
        saved = (self.sdir / "0002.md").read_text()
        self.assertNotIn("(auto)", saved)
        self.assertIn("D-1: Tabs", saved)
        self.assertIn("F-2: API port is 9090", saved)
        self.assertFalse((self.sdir / "0003.md").exists())
        led = {i["id"]: i for i in json.loads((self.root / "ledger.json").read_text())["items"]}
        self.assertEqual(led["T-1"]["status"], "closed")
        self.assertEqual(led["T-2"]["status"], "closed")
        self.assertEqual(led["F-1"]["status"], "closed")
        self.assertEqual(led["F-2"]["status"], "open")

    def test_token_lean_reading_modes_and_show(self):
        session(self.sdir, 1, "D: Use PostgreSQL with JSONB indexing\nF: Redis runs on port 6379\nT: Add rate limiting")
        session(self.sdir, 2, "D: Slides export uses PptxGenJS offline\nF: Playwright uses port 9333")
        ctx.compile_(self.root)
        _, full = quiet(ctx.load, self.root)
        _, slim = quiet(ctx.load, self.root, mode="slim")
        _, idx = quiet(ctx.load, self.root, mode="index")
        _, foc = quiet(ctx.load, self.root, focus=["slides", "pptx"])
        _, delta = quiet(ctx.load, self.root, since=1)
        _, same = quiet(ctx.load, self.root, since=2)

        self.assertIn("D-2 Slides export", foc)
        self.assertNotIn("D-1 Use PostgreSQL", foc)
        self.assertIn("T-1 Add rate limiting", foc)  # open tasks always kept in focused load
        self.assertLess(len(idx), len(full))
        self.assertIn("T-1 Add rate limiting", idx)
        self.assertIn("D-2", delta)
        self.assertNotIn("D-1", delta)
        self.assertIn("unchanged since s0002", same)

        # `show` inspects individual items, ranges, and sessions
        _, shown = quiet(ctx.show, self.root, ["D-1..D-2", "s0001"])
        self.assertIn("D-1 [open] (s0001) Use PostgreSQL", shown)
        self.assertIn("D-2 [open] (s0002) Slides export", shown)
        self.assertIn("# Session 0001", shown)

    def test_status_and_duplicate_detection(self):
        session(self.sdir, 1, "F: Checks pass: 60 offline tests pass, ruff and shellcheck clean")
        session(self.sdir, 2, "F: Checks pass: 80 offline tests pass, ruff and shellcheck clean")
        ctx.compile_(self.root)
        info, out = quiet(ctx.status, self.root)
        self.assertEqual(info["open_items"], 2)
        self.assertEqual(info["duplicates"], [("F-2", "F-1")])
        self.assertIn("F-2~F-1", out)

    def test_next_and_empty_load(self):
        session(self.sdir, 1, "T: Ship it")
        ctx.compile_(self.root)
        _, out = quiet(ctx.next_, self.root)
        self.assertIn("Save as session 0002", out)
        self.assertIn("- T-1 Ship it", out)
        _, empty = quiet(ctx.load, self.d / "nothing")
        self.assertIn("nothing saved yet", empty)

    def test_load_hook_formats(self):
        session(self.sdir, 1, "D: Keep it simple")
        _, plain = quiet(ctx.load, self.root)
        self.assertTrue(plain.startswith("# Project context"))
        _, js = quiet(ctx.load, self.root, "gemini")
        ctx_text = json.loads(js)["hookSpecificOutput"]["additionalContext"]
        self.assertIn("D-1 Keep it simple", ctx_text)


class Autosave(Base):
    def test_claude_transcript(self):
        quiet(ctx.save, self.root, "Summary: s\nF: saved")
        led = json.loads((self.root / "ledger.json").read_text())
        led["saved_at"] = "2000-01-01T00:00:00+00:00"
        (self.root / "ledger.json").write_text(json.dumps(led))
        tp = self.transcript([
            {"type": "user", "timestamp": "2999-01-01T00:00:00Z", "message": {"content": "add a dark mode toggle"}},
            {"type": "user", "message": {"content": "<command-name>/clear</command-name>"}},
            {"type": "assistant", "message": {"content": [
                {"type": "tool_use", "name": "Edit", "input": {"file_path": str(self.d / "app.css")}},
                {"type": "text", "text": "Added the toggle."}]}},
            {"type": "user", "message": {"content": [{"type": "tool_result", "content": "ok"}]}}])
        ctx.autosave(self.root, {"transcript_path": str(tp), "cwd": str(self.d)})
        auto = (self.sdir / "0002.md").read_text()
        for s in ("(auto)", "add a dark mode toggle", "app.css", "Added the toggle", "1 prompts"):
            self.assertIn(s, auto)
        self.assertNotIn("/clear", auto)
        quiet(ctx.save, self.root, "Summary: refined\nF: real")
        tp2 = self.transcript([{"type": "user", "timestamp": "2020-01-01T00:00:00Z", "message": {"content": "hi"}}])
        ctx.autosave(self.root, {"transcript_path": str(tp2)})
        self.assertEqual(sorted(p.name for p in self.sdir.glob("*.md")), ["0001.md", "0002.md"])

    def test_generic_codex_and_gemini_shapes(self):
        cases = {
            "generic.jsonl": [{"role": "user", "content": "fix the login bug"},
                              {"role": "assistant", "content": "Fixed.", "tool_calls": [
                                  {"function": {"name": "edit_file", "arguments": json.dumps({"path": "auth.py"})}}]}],
            "codex.jsonl": [{"timestamp": "2999-01-01T00:00:00Z", "type": "response_item", "payload": {
                                "type": "message", "role": "user",
                                "content": [{"type": "input_text", "text": "fix the login bug"}]}},
                            {"type": "response_item", "payload": {"type": "function_call", "name": "write_file",
                                                                  "arguments": json.dumps({"file_path": "auth.py"})}}],
        }
        for name, recs in cases.items():
            start, prompts, files, _ = ctx.read_transcript(self.transcript(recs, name))
            self.assertEqual(prompts, ["fix the login bug"], name)
            self.assertEqual(files, ["auth.py"], name)
        gem = self.d / "gemini.json"
        gem.write_text(json.dumps({"startTime": "2999-01-01T00:00:00Z", "messages": [
            {"type": "user", "content": "fix the login bug"},
            {"type": "gemini", "content": "Done.", "toolCalls": [{"name": "replace", "args": {"file_path": "auth.py"}}]}]}))
        start, prompts, files, last = ctx.read_transcript(gem)
        self.assertEqual((prompts, files, last, start[:4]), (["fix the login bug"], ["auth.py"], "Done.", "2999"))

    def test_missing_transcript_does_nothing(self):
        ctx.autosave(self.root, {"transcript_path": str(self.d / "missing.jsonl")})
        self.assertEqual(list(self.sdir.glob("*.md")), [])


FAKE_RANKER = r'''import sys
for l in sorted(sys.stdin.read().splitlines(), key=lambda l: 'Postgres' not in l):
    print(f"{0.9 if 'Postgres' in l else 0.1:.2f}\t{l}")
'''


class Find(Base):
    def test_closed_dropped_and_filtered_items(self):
        entries = {1: "F: API port is 8080\nD: Use SQLite", 2: "X: F-1 moved\nF: API port is 8081"}
        for n in range(1, 9):
            session(self.sdir, n, entries.get(n, f"T: task {n}"))
            ctx.compile_(self.root)
        self.assertFalse((self.sdir / "0001.md").exists())
        hits, out = quiet(ctx.find, self.root, ["port"])
        self.assertEqual({h["id"] for h in hits}, {"F-1", "F-2"})
        self.assertTrue(out.startswith("F-2 [open]"))
        self.assertIn("F-1 [closed s0002: moved]", out)
        # Filter by status and kind
        open_only, _ = quiet(ctx.find, self.root, ["port"], status_filter="open")
        self.assertEqual([h["id"] for h in open_only], ["F-2"])
        d_only, _ = quiet(ctx.find, self.root, [], kind_filter="D")
        self.assertEqual([h["id"] for h in d_only], ["D-1"])

    def test_ranker_then_builtin_fallback(self):
        session(self.sdir, 1, "F: Postgres runs on port 5432\nD: Use tabs for indentation")
        ctx.compile_(self.root)
        fake = self.d / "fake_ranker.py"
        fake.write_text(FAKE_RANKER)
        with mock.patch.object(ctx, "ranker_cmd", return_value=[sys.executable, str(fake)]):
            hits, out = quiet(ctx.find, self.root, ["database"])
        self.assertEqual([h["id"] for h in hits], ["F-1", "D-1"])
        self.assertTrue(out.startswith("0.90 F-1 [open]"))
        with mock.patch.object(ctx, "ranker_cmd", return_value=None):
            hits, _ = quiet(ctx.find, self.root, ["indent", "zzzz"])
            self.assertEqual([h["id"] for h in hits], ["D-1"])
            self.assertEqual(quiet(ctx.find, self.root, ["qqqq"])[0], [])


class Recall(Base):
    def setUp(self):
        super().setUp()
        session(self.sdir, 1, "D: Tickers repeat at most 40 times\nF: Login lives in .env\nT: Speed up the ticker")
        session(self.sdir, 2, "F: Tickers were slow\nX: F-2 moved")
        quiet(ctx.compile_, self.root)

    def test_only_open_matching_decisions_and_facts(self):
        _, out = quiet(ctx.recall, self.root, "make the ticker repeat less")
        self.assertIn("D-1 Tickers repeat at most 40 times", out)
        self.assertNotIn("T-1", out)  # tasks are already in every load mode
        self.assertEqual(quiet(ctx.recall, self.root, "hello there")[1], "")
        self.assertEqual(quiet(ctx.recall, self.root, "")[1], "")
        self.assertEqual(quiet(ctx.recall, self.root, "ticker", min_score=1.1)[1], "")

    def test_ranker_only_from_env(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(ctx.ranker_cmd())
        with mock.patch.dict(os.environ, {"CTX_RANKER": '"C:\\a b\\py.exe" -I "C:\\x y\\rank.py"'}):
            self.assertEqual(ctx.ranker_cmd(), ["C:\\a b\\py.exe", "-I", "C:\\x y\\rank.py"])  # no quotes kept

    def test_noise_rules(self):
        items = ctx.read_ledger(self.root)["items"]
        self.assertEqual(ctx.recall_items(items, "thanks, that looks good now"), [])  # chat words only
        self.assertEqual(ctx.recall_items(items, "can you look at the tickers"), [])  # one topic word
        self.assertEqual([i["id"] for i in ctx.recall_items(items, "do the tickers repeat?")], ["D-1"])
        self.assertLessEqual(ctx.score_items(items, ["ticker", "ticker", "repeat"])[0][0], 1.0)  # repeats count once
        self.assertEqual(ctx.score_items(items, ["ticker", "login"], min_terms=2), [])

    def test_hook_formats_and_stdin(self):
        _, js = quiet(ctx.recall, self.root, "ticker repeat", "gemini")
        out = json.loads(js)["hookSpecificOutput"]
        self.assertEqual(out["hookEventName"], "BeforeAgent")
        self.assertIn("D-1", out["additionalContext"])
        _, js = quiet(ctx.recall, self.root, "ticker repeat", "codex")
        self.assertEqual(json.loads(js)["hookSpecificOutput"]["hookEventName"], "UserPromptSubmit")
        self.assertEqual(quiet(ctx.recall, self.root, "nothing here", "gemini")[1].strip(), "{}")
        with mock.patch.object(sys, "stdin", io.StringIO(json.dumps({"prompt": "ticker repeat"}))):
            _, out = quiet(ctx.main, ["recall", "--dir", str(self.root)])
        self.assertIn("D-1", out)

    def test_broken_ledger_never_fails_the_prompt(self):
        (self.root / "ledger.json").write_text("{not json", encoding="utf-8")
        with mock.patch.object(ctx, "read_ledger", side_effect=ValueError("bad")):
            self.assertEqual(quiet(ctx.recall, self.root, "ticker")[1], "")


class Init(Base):
    def test_init_wiring_is_safe_and_idempotent(self):
        proj = self.d / "proj"
        (proj / ".claude").mkdir(parents=True)
        (proj / ".claude" / "settings.json").write_text('{"model": "opus"}')
        (proj / "AGENTS.md").write_text("# Team rules\nUse tabs.\n")
        code, out = quiet(ctx.init, proj, False, ["claude", "gemini"], ["AGENTS.md"])
        self.assertEqual(code, 1)
        self.assertIn("FLAG", out)
        self.assertEqual(json.loads((proj / ".claude" / "settings.json").read_text()), {"model": "opus"})
        self.assertTrue((proj / ".ctx" / "ctx.py").exists() and (proj / ".ctx" / "README.md").exists())
        gem = json.loads((proj / ".gemini" / "settings.json").read_text())
        self.assertIn("load --slim --hook gemini", json.dumps(gem))
        self.assertIn("recall --hook gemini", json.dumps(gem["hooks"]["BeforeAgent"]))
        for _ in range(2):
            self.assertEqual(quiet(ctx.init, proj, True, ["claude", "gemini"], ["AGENTS.md"])[0], 0)
        merged = json.loads((proj / ".claude" / "settings.json").read_text())
        self.assertEqual(merged["model"], "opus")
        self.assertEqual(len(merged["hooks"]["SessionStart"]), 1)
        self.assertEqual(len(merged["hooks"]["UserPromptSubmit"]), 1)
        self.assertIn("load --slim", json.dumps(merged["hooks"]["SessionStart"]))
        self.assertEqual(len(merged["permissions"]["allow"]), 1)
        agents = (proj / "AGENTS.md").read_text()
        self.assertTrue(agents.startswith("# Team rules"))
        self.assertEqual(agents.count(ctx.MARKER), 2)

    def test_hook_files_match_what_init_writes(self):
        proj = self.d / "fresh"
        (proj / ".git").mkdir(parents=True)
        with mock.patch.object(ctx, "python_cmd", return_value="python"):
            quiet(ctx.init, proj, False, ["claude", "gemini"], ["AGENTS.md"])
        hooks = SCRIPTS.parent / "hooks"
        for name in ("claude", "gemini"):
            want = json.loads((proj / f".{name}" / "settings.json").read_text(encoding="utf-8"))
            have = json.loads((hooks / name / "settings.json").read_text(encoding="utf-8"))
            self.assertEqual(have, want, f"hooks/{name}/settings.json is out of date: copy it from init")
        self.assertEqual((hooks / "any" / "AGENTS-block.md").read_text(encoding="utf-8"),
                         (proj / "AGENTS.md").read_text(encoding="utf-8"), "hooks/any/AGENTS-block.md is out of date")

    def test_docs_links_resolve(self):
        import re
        skill = SCRIPTS.parent
        for md in skill.rglob("*.md"):
            for target in re.findall(r"\]\(([^)#:]+)\)", md.read_text(encoding="utf-8")):
                self.assertTrue((md.parent / target).exists(), f"{md.relative_to(skill)} links to missing {target}")

    def test_init_agents_and_claude_modes(self):
        p_ag = self.d / "p_agents"
        p_ag.mkdir()
        quiet(ctx.init, p_ag, agents=True)
        self.assertTrue((p_ag / ".agents" / "context" / "ctx.py").exists())
        p_cl = self.d / "p_claude"
        p_cl.mkdir()
        quiet(ctx.init, p_cl, claude=True)
        self.assertTrue((p_cl / ".claude" / "context" / "ctx.py").exists())
        self.assertTrue((p_cl / ".claude" / "commands" / "save.md").exists())

    def test_find_root_walks_up_and_adopts_all_conventions(self):
        for folder in (".ctx", ".context", ".agents/context", ".claude/context"):
            proj = self.d / folder.replace("/", "_")
            (proj / folder / "sessions").mkdir(parents=True)
            (proj / "src" / "deep").mkdir(parents=True)
            (proj / ".git").mkdir()
            with mock.patch.object(ctx, "HERE", SCRIPTS):
                self.assertEqual(ctx.find_root(proj / "src" / "deep"), proj / folder)
        fresh = self.d / "fresh"
        (fresh / ".git").mkdir(parents=True)
        with mock.patch.object(ctx, "HERE", SCRIPTS):
            self.assertEqual(ctx.find_root(fresh), fresh / ".ctx")
            self.assertEqual(ctx.find_root(None, str(self.root)), self.root)

    def test_cli_save_from_file_and_inline_text(self):
        entry = self.d / "entry.md"
        entry.write_text("Summary: via file\nT: Write tests", encoding="utf-8")
        with mock.patch.object(ctx, "HERE", SCRIPTS):
            _, out = quiet(ctx.main, ["save", "--dir", str(self.root), "--file", str(entry)])
            self.assertIn("T-1", out)
            # Literal \n in --text is unescaped so D: and X: are parsed properly
            _, out2 = quiet(ctx.main, ["save", "--dir", str(self.root), "--text", "Summary: inline\\nD: Use Argon2id\\nX: T-1 done"])
            self.assertIn("D-1", out2)
        led = {i["id"]: i for i in json.loads((self.root / "ledger.json").read_text())["items"]}
        self.assertEqual(led["T-1"]["status"], "closed")
        self.assertEqual(led["D-1"]["status"], "open")


if __name__ == "__main__":
    unittest.main()
