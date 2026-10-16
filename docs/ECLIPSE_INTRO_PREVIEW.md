# Eclipse intro comparison

- Main local login, now using Eclipse: http://127.0.0.1:4317/
- Temporary comparison/mirror: http://127.0.0.1:4318/

The mirror runs on loopback only. It uses the same live account endpoints and data as the main local ForgeRadar service. Eclipse has been promoted to the main login; port 4318 remains available temporarily for this design review. It does not create an account, publish anything or expose a port to other devices. Port 4317 must be running first.

Start manually with `node preview-eclipse.mjs` in the ForgeRadar folder. The process started for this comparison is recorded in `data/eclipse-preview.pid`. To stop it, verify that PID is running this folder's `preview-eclipse.mjs`, then stop that process. The preview can be restarted without changing saved account data.

The intro replays from the footer, skips on request, and is omitted when the operating system requests reduced motion.
