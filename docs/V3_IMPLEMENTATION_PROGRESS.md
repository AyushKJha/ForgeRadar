# ForgeRadar V3 implementation progress

Status is based on code and tests, not design intent. V3 has not been deployed or pushed.

- [x] Phase A — Audit & stability. Audit, architecture, inventory, risk log and recovery procedure written. `backup.mjs` created and a live-data snapshot verified by checksum and SQLite integrity. The daily launcher now uses process-local PowerShell script permission and exits cleanly without duplicate work. Baseline tests: 20/20 passed.
- [x] Phase B — Local free foundation. Versioned SQLite migrations provide job history, a durable pending-command queue and 24-hour source cache. Pending commands resume once after restart; claimed work becomes interrupted and requires review. The next collection time persists. Settings shows actual job/model/source diagnostics and opt-in OpenAlex/Crossref records with separate publication/retrieval dates. Local Ollama remains sequential; low-memory runs are blocked, and existing heuristic discovery/manual planning still work without it. Existing cached data remains available offline. arXiv, full source-wide opt-in controls and advanced manual development remain for later phases.
- [x] Phase C — Local multi-user accounts with isolated profiles, consented manual interests, reviewed PDF/DOCX suggestions, public GitHub portfolio selection, export and deletion. Owner-only legacy APIs remain protected. Remote member access and richer provenance review remain for later phases.
- [ ] Phase D — Discovery intelligence. In progress: per-user research feed now applies a hard selected/excluded-domain filter, offers six explicit modes, separates publication from retrieval age, explains heuristic weights, and has an honest empty state. Source-specific scans, feedback, comparable-work checks, Battle and skill gap remain.
- [ ] Phase E — Project studio, tasks and agents.
- [ ] Phase F — Validation evidence and protected remote access.
- [ ] Phase G — Explicit public publication workflow.
- [ ] Phase H — Nebula and Sunset product experience.

Current command: `node --test tests.mjs remote-tests.mjs app-kit-tests.mjs v3-store-tests.mjs v3-profile-tests.mjs v3-auth-tests.mjs resume-parser-tests.mjs portfolio-import-tests.mjs research-sources-tests.mjs v3-discovery-tests.mjs` — 37 passed, 0 failed on 2026-10-15 with localhost access. `npm` is unavailable in the current runtime, so tests ran directly with Node. The initial sandboxed baseline run had 19 passes and one `EACCES` loopback failure; this was an environment restriction, not an application test failure.
