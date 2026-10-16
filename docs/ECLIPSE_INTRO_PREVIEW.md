# Eclipse intro comparison

- Current local login: http://127.0.0.1:4317/
- Eclipse-aligned comparison: http://127.0.0.1:4318/

The comparison runs on loopback only. It uses the same live account endpoints and data as the main local ForgeRadar service; only the login/intro visual layer differs. It does not create an account, publish anything or expose a port to other devices. Port 4317 must be running first.

Start manually with `node preview-eclipse.mjs` in the ForgeRadar folder. The process started for this comparison is recorded in `data/eclipse-preview.pid`. To stop it, verify that PID is running this folder's `preview-eclipse.mjs`, then stop that process. The preview can be restarted without changing saved account data.

The intro replays from the footer, skips on request, and is omitted when the operating system requests reduced motion.
