# ForgeRadar audit

## Fixed
- Scope checks confused prohibited requirements with sentences forbidding them.
- Proposal repair repeatedly fed an invalid older plan back to the model.
- Startup returned before the local model became ready.
- Failed builds left workspaces labelled Building.
- Added a public Node dashboard with owner login, CSRF checks and worker authentication.
- Added an outbound laptop worker connection. GitHub credentials and local AI stay on the laptop; persistent state stays on its disk.
- Preview assets remain isolated and network-disabled. Worker commands are allowlisted and serialized.
- New-project direction and community evidence survive the build pipeline.

## Deployment conditions
The public dashboard uses Render's free web service. It cannot run the GPU model. Keep the laptop awake and launch start.ps1 for autonomous work. An offline worker causes clear errors; no work is fabricated. Cloud state is a cache refreshed by the laptop after restart. In-flight cloud commands are not durable across a service restart and must be reissued. Local build artifacts are retained.

## Still limited
- Instagram is caption import, not automated crawling. X requires authorized API access.
- Builder supports offline prototypes and persistent single-owner Node + SQLite data apps. Arbitrary server code, payments, external integrations and multi-user systems are not supported.
- Novelty and demand scores require real user validation.
- Syntax/scope QA is not behavioral QA; generated applications require acceptance review.
- No claim of continuous execution while the laptop is off.

## Additional prompt and deployment fixes
- New discoveries stop at a proposal; code and repository creation require an explicit owner build instruction.
- Conversation history and shortcuts are available without navigating between pages.
- Status replies use actual engine configuration rather than model-generated claims.
- Sign-in uses a tested JSON session response, secure owner cookie and visible errors.
- Idle telemetry no longer resets ranking or source-import forms every few seconds.
- Authenticated live integration checks verify the public prompt composer, worker connection and a completed status instruction.

## Browser acceptance results
The final hosted login succeeded in Chrome. A progress prompt sent through the visible composer completed on the local worker. The isolated prototype rendered and category filtering, case-insensitive search, pasted CSV with quoted commas and invalid-price validation passed. File-picker automation was unavailable because extension file access was disabled; it is not claimed as tested. The requested viewport override did not change this Chrome session's effective dimensions, so mobile browser verification remains unconfirmed. Responsive CSS and reduced-motion handling are included.

Owner sessions are signed and expire after twelve hours, remaining valid through normal redeployments with unchanged secrets. Automated discovery is enabled every six hours and proposes work for approval. Daily sync is enabled at 9 PM India time. Automatic code regeneration is disabled; approved projects can receive requested changes through the composer. A Codex heartbeat is configured to run the daily entry point when this laptop and Codex are available.

## Persistent application upgrade — 2026-10-05
Full-stack mode compiles a validated data model into a reviewed Node + SQLite service, with persistent CRUD, typed forms, search, CSV/JSON import and JSON export. Database records and secrets are excluded from GitHub. Compiler QA executes CRUD, validation, repeated-request and restart-persistence acceptance tests. A live Ollama build of the already-approved wishlist project completed and was synced to its existing private repository. First-pass model fields can fail validation; bounded repair retries expose the failure rather than publishing invalid code.

The prompt composer now saves instructions in this browser before transmission. Durable local worker receipts suppress duplicate execution. Cloud restart recovery resends browser-saved IDs; unfinished accepted worker jobs are reported as interrupted and can be retried. This is browser-local durability, not a cross-device hosted queue. Clearing browser storage removes unsent instructions. A current-user Windows Startup shortcut launches the worker supervisor, which checks model, engine and bridge every 30 seconds. It cannot execute while the laptop is off.

Mastodon public hashtag collection returned 24 posts in a live check, and Reddit RSS returned 15. Bluesky public search returned HTTP 403 and is shown as unavailable; no bypass is attempted. X requires authorized API access and Instagram remains caption import. Neither is presented as an active automatic connection.

A real Chrome viewport override at 390 by 844 exposed summary-counter horizontal overflow. The mobile summary was changed to two columns with wrapped values. Full-stack preview forms need allow-forms in their reviewed-runtime iframe; offline model-generated prototypes retain their stricter sandbox. Application relay requests remain owner-authenticated, origin-checked and restricted to reviewed database operations.

## Hosted acceptance — 2026-10-06
All 20 automated checks passed with loopback HTTP access enabled. The authenticated live smoke check confirmed owner sign-in, blocked unauthenticated state access, connected worker and a completed remote status prompt. Chrome verified the deployed reviewed iframe permits forms and saves a record into SQLite. Earlier pasted CSV import retained its two imported records across the next day's session. At a real 390 x 844 viewport the dashboard had no horizontal overflow.

The laptop bridge and supervisor were temporarily stopped. A status instruction was saved, survived browser reload, and completed after restoring the supervisor. The updated approved application's runtime was synced to its own private repository. Browser-local queue limitations and supported data-app scope still apply; this does not claim arbitrary autonomous software development or off-laptop execution.
