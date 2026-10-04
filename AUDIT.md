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
