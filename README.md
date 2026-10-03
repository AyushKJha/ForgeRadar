# ForgeRadar — local MVP

Discover software opportunity signals, inspect evidence, rank candidates and create project plans. No cloud AI billing or package installation required. Requires Node.js 22 or later.

## Run

From this folder, run `node server.mjs`, then open http://127.0.0.1:4317. The server binds only to this computer. Run `node --test tests.mjs` for core checks.

## Implemented

- Hacker News top-story collector and GitHub recent-repository collector, with per-source errors.
- Deduplication by source ID, four keyword topic clusters and editable weighted ranking.
- Evidence-linked proposals, saved and dismissed candidates, Markdown export.
- Optional Ollama JSON analysis with validated output and a critic prompt.
- Persistent local JSON data and project proposal/task files.
- Run history and local model connection status.

Click Refresh sources to collect live evidence. Sample mode contains illustrative examples, explicitly labelled. A refresh replaces sample candidates with actual signals. Source refresh is manual in V1.

## Local AI

Install Ollama from https://ollama.com/download, download a model appropriate for your hardware, and leave Ollama running at its default local address. The model selector lists models already installed. Then open a proposal and choose Analyze with local AI. No paid provider or API key is used. Model installation is not automatic.

API references: https://docs.ollama.com/api/chat ; https://github.com/HackerNews/API ; https://docs.github.com/en/rest/search/search

## Honest limits

This is an initial working vertical slice, not an autonomous project factory. Topic mining uses keyword rules until local analysis is requested. Baseline component scores are hand-authored estimates; source counts only proxy current signal strength. There is no historical trend measurement, validated competition research or adoption prediction. Local AI analysis uses one model call, not independent agents. GitHub anonymous rate limits may restrict refreshes. No authentication, scheduled ingestion, embeddings, coding agents or deployment pipeline is implemented.

Create project plan writes `projects/<id>/PROPOSAL.md` and `TASKS.md`. It does not generate application code. Architecture approval, sandboxed builders, testing and deployment gates are later milestones.

Data is in `data/state.json`. Public source text is treated as untrusted; the app renders text safely and validates AI output. This is a single-user loopback service; do not expose it to a network without adding authentication and hardening.

## Next milestones

1. Collect issue-level pain points and historical snapshots; calibrate ranking against user feedback.
2. Split local analysis into extractor, career evaluator and critic roles, with evidence citations.
3. Add architecture review and an isolated coding workspace for one approved project at a time.
