# ForgeRadar V3 implementation progress

Status is based on code and tests, not design intent. V3 has not been deployed or pushed.

- [x] Phase A — Audit & stability. Audit, architecture, inventory, risk log and recovery procedure written. `backup.mjs` created and a live-data snapshot verified by checksum and SQLite integrity. The daily launcher now uses process-local PowerShell script permission and exits cleanly without duplicate work. Baseline tests: 20/20 passed.
- [ ] Phase B — Local free foundation. Versioned SQLite job history and 24-hour source cache now run in the local engine; interrupted jobs are identified after restart. The Settings page shows real job/model/source diagnostics and opt-in OpenAlex/Crossref research fetches with publication and retrieval dates. Durable pending-job scheduling, replay policy, model fallback/resource checks, more verified connectors and full offline workflow remain.
- [ ] Phase C — Profiles and consented imports.
- [ ] Phase D — Discovery intelligence.
- [ ] Phase E — Project studio, tasks and agents.
- [ ] Phase F — Validation evidence and protected remote access.
- [ ] Phase G — Explicit public publication workflow.
- [ ] Phase H — Nebula and Sunset product experience.

Current command: `node --test tests.mjs remote-tests.mjs app-kit-tests.mjs v3-store-tests.mjs research-sources-tests.mjs` — 23 passed, 0 failed on 2026-10-15 with localhost access. The initial sandboxed baseline run had 19 passes and one `EACCES` loopback failure; this was an environment restriction, not an application test failure.
