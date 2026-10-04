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
- Builder scope is offline browser prototypes, not arbitrary production backend applications.
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
