# ForgeRadar

A local agent system for discovering software ideas, evaluating who would use them, proposing projects, building offline prototypes or persistent Node + SQLite applications, and syncing each approved project to its own private GitHub repository.

Discovery includes **unbuilt community ideas**, unmet needs and improvements to existing tools. A popular existing repository is context, not automatic proof that copying it would be worthwhile. Novelty remains unverified until researched, and a limited search cannot prove that no product exists.

## Agent circuit

`Scout → Miner → Evaluator → Critic → Proposal → Architect → Builder → QA → GitHub Sync`

Each role has separate instructions, validated outputs and explicit handoffs. Roles share one locally running model and execute in dependency order. The console displays actual engine states through server-sent events, agent inputs and outputs, handoff payloads and an event trail. Animation reflects running stages; there are no simulated agent events.

- **Scout:** collects community signals and imports.
- **Miner:** extracts feasible ideas, classifies their origin and links source evidence.
- **Evaluator:** estimates merit, audience fit, career value, feasibility and adoption potential.
- **Critic:** searches GitHub and Hacker News for existing-solution signals, questions demand and revises competition/novelty estimates.
- **Proposal:** writes a short proposal and explains the choice relative to alternatives.
- **Architect:** defines supported application scope and acceptance checks.
- **Builder:** generates offline interfaces, or a validated data model compiled into a reviewed Node + SQLite backend and accessible browser interface.
- **QA:** checks syntax and offline scope for prototypes. Persistent applications also run database CRUD, input-validation and restart-persistence acceptance tests before publication. Domain workflows still require owner review.
- **GitHub Sync:** creates a private repository per generated project and commits each changed snapshot atomically, without force-pushing.

## Run locally

Requires Node.js 24+ and Git. No npm packages are required.

On Windows, run `./start.ps1` in PowerShell. It launches the engine in the background and starts an available Ollama runtime. Open http://127.0.0.1:4317.

Alternatively, start Ollama separately and run `node server.mjs`.

Run `./install-worker.ps1` once on Windows to install the current-user startup shortcut and recovery supervisor. It starts at Windows sign-in and checks the engine, model and bridge every 30 seconds. Remove **ForgeRadar Worker.lnk** from your Startup folder to disable automatic startup. This installation uses no administrator privilege and does not run while Windows is off.

For this workspace, a portable Ollama runtime and `qwen3:4b` were downloaded under `../../work/ollama`. The launcher also supports an Ollama installation on PATH. On another machine, install Ollama from https://ollama.com/download and download an appropriate local model. This laptop has 16 GB system RAM and an RTX 4060 with 8 GB GPU memory; inference is sequential to limit resource usage.

## Sources

| Source | Discovery access |
| --- | --- |
| Hacker News | Ask HN and top-story API |
| Reddit | Public RSS for SomebodyMakeThis, AppIdeas and SideProject, with a one-hour cache; rate-limit errors are visible |
| Stack Overflow | Public questions API |
| GitHub | Recent repository activity and existing-solution searches |
| Mastodon | Public appideas, software and opensource hashtag timelines, where the instance permits public access |
| Bluesky | Public search adapter; HTTP access errors are visible. A connected state is shown only after real results are returned. |
| X / Twitter | Optional recent-search API adapter; disabled by default. Requires X_BEARER_TOKEN and explicit FORGERADAR_X_ENABLED=1. Platform access may have costs. |
| Instagram | Public post/caption imports; automated Instagram discovery is not connected |

Posts imported through Ports are preserved across refreshes. Evidence selection balances communities and prioritizes idea requests within each source.

## GitHub

The engine reuses Git Credential Manager credentials saved for github.com, or an existing GITHUB_TOKEN/GH_TOKEN environment variable. It never displays or stores a token in application state. Credentials must permit repository creation and contents changes.

The platform source repository is private **AyushKJha/ForgeRadar**. Run `node platform-sync.mjs "Describe the source changes"` to commit platform changes. Runtime data, models, generated projects and environment files are excluded.

Generated projects use separate private repositories. Only the explicit code/document allowlist is uploaded; logs, local state and credentials are not included. Unchanged snapshots do not create commits. Publishing to an existing unrelated repository is refused.

## Automation

Enable automation in System to collect every six hours while the local engine is running. Daily synchronization at **21:00 Asia/Kolkata** pushes completed approved work. This deployment keeps automatic code iterations off; request changes through the prompt bar. New ideas always await approval. A failed daily attempt is not repeatedly retried every 30 seconds.

`node daily.mjs` is the scheduled daily entry point. It starts the local services when needed and respects the dashboard pause setting. A Codex heartbeat can invoke it when this computer and Codex are available; it cannot execute while the computer is off. Source publication is separately available through platform-sync.mjs.

## Validation and limits

Run `npm test`. Tests cover scoring, social parsing, evidence sampling, scheduling, role ordering, artifact validation, durable SQLite CRUD, idempotency, app compilation, full-stack pipeline, authenticated relay delivery and stopping when a model is unavailable. The orchestration tests use model fixtures; a live model mission is a separate integration check.

The builder supports two modes. **Offline prototype** generates custom HTML/CSS/JavaScript, sandboxed with network access disabled. **Persistent application** generates a typed data model for a reviewed Node + SQLite runtime: create/edit/delete records, search, CSV/JSON import, JSON export and persistence. Full-stack apps run through the owner dashboard and can run independently from their source repository using `npm start`. Generated app data and databases are excluded from GitHub. The model never executes arbitrary shell commands or installs packages.

The persistent mode is a single-owner data application builder, not an unrestricted coding environment: custom backends, payments, third-party APIs and multi-user roles remain outside its supported scope. Database acceptance tests do not establish correct domain behavior, product demand or security certification.

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


## Public dashboard
The Render service runs remote.mjs with a strong owner password and a separate worker token. Launch start.ps1 on this laptop to start bridge.mjs. The bridge makes outbound HTTPS requests; no router ports or GitHub credentials are exposed. Cloud state is a temporary cache of the laptop's persistent state. Public URLs require owner login before any project data or commands are available. The free dashboard does not provide always-on cloud GPU execution.


## Prompt-first workflow
Use the always-visible workshop composer to describe a new idea, request discovery, ask about progress, pause/resume automation or sync completed work. New ideas produce a proposal and wait. Type `Approve and build <proposal title>` or select the build mode and click **Approve & build**. Every approved completed project receives its own private repository with README, runnable source, proposal, architecture, tasks and QA report.

Instructions are first saved in this browser's persistent outbox. Keep or reopen this browser after the laptop reconnects to deliver them. The outbox survives page reloads and a cloud service restart; it does not synchronize between devices, and clearing browser storage removes unsent instructions. Worker receipts prevent retransmission from running an accepted instruction twice. Interrupted jobs show their saved state and can be retried after reviewing artifacts. The cloud service has an ephemeral cache, not a durable hosted database. It cannot process jobs while the laptop is off.

Example prompts:
- Propose an offline tool that organizes my reading list by topic.
- Find useful unbuilt ideas from communities and propose the strongest one.
- Approve and build Reading Queue.
- Improve Reading Queue by adding a topic filter.
- Sync completed approved projects to GitHub.
- Pause automation.

The assistant uses the local model to select from bounded actions. It does not have Codex's unrestricted terminal, package installation, arbitrary repository editing or cloud GPU capabilities.
