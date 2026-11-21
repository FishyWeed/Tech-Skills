# Tech Skills

AI skills that work with Claude Code and other AI agents. Each skill is one folder in this repository, with its own
`README.md`, setup guide and MIT license. The instructions are plain Markdown and every step is a normal script, so
any agent that can read files and run shell commands can use them.

| Skill | What it does | Details |
| --- | --- | --- |
| [DocPC](../DocPC/) (Document Pipeline Composer) | Builds graded assignment documents (proposals, reports, meeting minutes, progress sheets, filled forms) from source files: text scripts, editable draw.io diagrams, Word assembly with the lecturer's cover, and checks. You can rebuild a document at any time. | Platform: Windows with Microsoft Word and Excel (some steps work anywhere)<br>Needs: Node.js 18 or later, Microsoft Edge<br>Start: `/docpc` in Claude Code<br>[README](../DocPC/README.md) · [Setup](../DocPC/SETUP.md) · [License](../DocPC/LICENSE) |
| [CTX-PLINE](../CTX-PLINE/) (Context Pipeline) | Session memory for software projects, for any model in any tool. It keeps decisions, facts, tasks and issues as plain files in the project, and gives each new session only what it needs. | Platform: any system with Python 3<br>Needs: no packages, no network, no model calls<br>Tools: Claude Code, Gemini CLI, Codex, any tool that runs shell commands<br>[README](../CTX-PLINE/README.md) · [Setup](../CTX-PLINE/SETUP.md) · [License](../CTX-PLINE/LICENSE) |

## Get the skills

```bash
git clone https://github.com/FishyWeed/Tech-Skills.git
```

Then follow the `README.md` in the folder of the skill that you want. It has the full details and the install steps.
