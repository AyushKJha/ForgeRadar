# ForgeRadar

A local agent system for discovering software ideas, evaluating who would use them, proposing the strongest project, building a browser prototype and syncing it to a separate private GitHub repository.

Discovery includes **unbuilt community ideas**, unmet needs and improvements to existing tools. A popular existing repository is context, not automatic proof that copying it would be worthwhile. Novelty remains unverified until researched, and a limited search cannot prove that no product exists.

## Agent circuit

`Scout → Miner → Evaluator → Critic → Proposal → Architect → Builder → QA → GitHub Sync`

Each role has separate instructions, validated outputs and explicit handoffs. Roles share one locally running model and execute in dependency order. The console displays actual engine states through server-sent events, agent inputs and outputs, handoff payloads and an event trail. Animation reflects running stages; there are no simulated agent events.

- **Scout:** collects community signals and imports.
- **Miner:** extracts feasible ideas, classifies their origin and links source evidence.
- **Evaluator:** estimates merit, audience fit, career value, feasibility and adoption potential.
- **Critic:** searches GitHub and Hacker News for existing-solution signals, questions demand and revises competition/novelty estimates.
- **Proposal:** writes a short proposal and explains the choice relative to alternatives.
- **Architect:** defines one bounded prototype and acceptance checks.
- **Builder:** generates HTML, CSS and JavaScript files in a project workspace.
- **QA:** checks JavaScript syntax and offline scope before publication. Behavioral checks still require browser review.
- **GitHub Sync:** creates a private repository per generated project and commits each changed snapshot atomically, without force-pushing.

## Run locally

Requires Node.js 22+ and Git. No npm packages are required.

On Windows, run `./start.ps1` in PowerShell. It launches the engine in the background and starts an available Ollama runtime. Open http://127.0.0.1:4317.

Alternatively, start Ollama separately and run `node server.mjs`.

For this workspace, a portable Ollama runtime and `qwen3:4b` were downloaded under `../../work/ollama`. The launcher also supports an Ollama installation on PATH. On another machine, install Ollama from https://ollama.com/download and download an appropriate local model. This laptop has 16 GB system RAM and an RTX 4060 with 8 GB GPU memory; inference is sequential to limit resource usage.

## Sources

| Source | Discovery access |
| --- | --- |
| Hacker News | Ask HN and top-story API |
| Reddit | Public RSS for SomebodyMakeThis, AppIdeas and SideProject, with a one-hour cache; rate-limit errors are visible |
| Stack Overflow | Public questions API |
| GitHub | Recent repository activity and existing-solution searches |
| X / Twitter | Optional recent-search API adapter; disabled by default. Requires X_BEARER_TOKEN and explicit FORGERADAR_X_ENABLED=1. Platform access may have costs. |
| Instagram | Public post/caption imports; automated Instagram discovery is not connected |

Posts imported through Ports are preserved across refreshes. Evidence selection balances communities and prioritizes idea requests within each source.

## GitHub

The engine reuses Git Credential Manager credentials saved for github.com, or an existing GITHUB_TOKEN/GH_TOKEN environment variable. It never displays or stores a token in application state. Credentials must permit repository creation and contents changes.

The platform source repository is private **AyushKJha/ForgeRadar**. Run `node platform-sync.mjs "Describe the source changes"` to commit platform changes. Runtime data, models, generated projects and environment files are excluded.

Generated projects use separate private repositories. Only the explicit code/document allowlist is uploaded; logs, local state and credentials are not included. Unchanged snapshots do not create commits. Publishing to an existing unrelated repository is refused.

## Automation

Enable automation in System to collect every six hours while the local engine is running. Daily work at **21:00 Asia/Kolkata** improves an existing prototype and syncs completed work. A failed daily attempt is not repeatedly retried every 30 seconds.

`node daily.mjs` is the scheduled daily entry point. It starts the local services when needed and respects the dashboard pause setting. A Codex heartbeat can invoke it when this computer and Codex are available; it cannot execute while the computer is off. Source publication is separately available through platform-sync.mjs.

## Validation and limits

Run `node --test tests.mjs`. Tests cover scoring, source parsing, fair evidence sampling, India-time scheduling, role ordering, artifact validation and stopping when a model is unavailable. The orchestration tests use model fixtures; a live model mission is a separate integration check.

The builder currently produces **offline browser prototypes**, not production backend services. It does not run model-generated shell commands or install packages. Generated previews are sandboxed and network-disabled. QA validates syntax and scope; that does not establish correct behavior, product demand or security certification.

Scores are estimates. There is no measured historical trend model, comprehensive market research, Instagram crawler or claim to detect every idea on the internet. The service is single-user and binds to loopback; do not expose it to a network without authentication and further hardening.

State is stored in `data/state.json`; project artifacts are under `projects/<id>/`. Model output failures preserve prior artifacts and are visible in the circuit.

## API references

- https://docs.ollama.com/api/chat
- https://github.com/HackerNews/API
- https://www.reddit.com/r/reddit.com/wiki/rss/
- https://docs.github.com/en/rest/search/search
- https://docs.github.com/en/rest/git
- https://docs.x.com/x-api/posts/search-recent-posts

## New ideas are first-class projects
Community requests for software that has not been built enter the same discovery, evaluation, proposal and build pipeline as existing-project improvements. Every candidate records its origin and whether the work creates a new project or improves an existing one. Public discussion is evidence of an idea, not proof of demand or originality. The critic checks available competing solutions before ranking; feasible candidates can proceed to their own private repository.

