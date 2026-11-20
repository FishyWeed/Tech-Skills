# 1. Start a session: load the context

If a hook already added `# Slim context` or `# Project context` to your prompt, skip this step.

Pick the smallest view that fits the task:

| Situation | Command | What you get |
|---|---|---|
| Default | `CTX load --slim` | All open tasks and issues in full, the 30 newest decisions and facts as lines of at most 95 characters and the last two session summaries |
| A known topic | `CTX load --focus <words>` (or `CTX read <words>`) | All open tasks and issues, the last two sessions and only the decisions and facts that match the words |
| A quick look, or a subagent | `CTX load --index` | Counts, all open tasks and issues and the latest session summary |
| You loaded recently | `CTX load --since <N>` | Only the items and sessions added or closed after session `N` |
| A small project, or a full audit | `CTX load` | The full `digest.md`: all open items, recent sessions and recently closed items |

The slim view shortens older decisions and facts. When a short line is not enough, use `CTX show <ID>`, or let
[recall](2-recall.md) give the full text for the task.

Treat open decisions and facts as binding project rules, unless the user overrides them.
