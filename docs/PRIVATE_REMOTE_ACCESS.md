# Private V3 access from your devices

Status on 2026-10-15: application-layer proxy support is implemented and tested against a simulated HTTPS tailnet host. Tailscale is not installed on this laptop, and no Serve route has been enabled. Access from a phone has **not** been verified. Local ForgeRadar still binds only to `127.0.0.1:4317`.

The preferred free route is [Tailscale Personal](https://tailscale.com/pricing) plus [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve). Tailscale currently lists its Personal plan as $0 with up to six users and unlimited personal devices. Serve shares a loopback web service with devices in the same tailnet over HTTPS; [Funnel](https://tailscale.com/docs/features/tailscale-serve) is the separate public-internet feature and must not be used here. Plan terms can change, so check the vendor page before activation.

After the owner approves private exposure and installs/signs in to Tailscale on the laptop and phone:

1. Confirm both devices are in the same tailnet and restrict tailnet access to the intended owner devices. Enable HTTPS certificates for the tailnet if prompted by Serve.
2. Read the laptop's exact `*.ts.net` hostname from Tailscale. Set `FORGERADAR_TAILSCALE_HOST` to that hostname before starting ForgeRadar, then restart the local engine. This explicit exact-host allowlist is necessary; the variable should contain no scheme, slash, or port.
3. Confirm the local dashboard works at `http://127.0.0.1:4317`. Then, in an administrator terminal on Windows, use `tailscale serve 4317` to proxy that local port privately. This foreground form ends when the terminal closes; Tailscale documents `--bg` for a persistent route and `tailscale serve off` to remove it. Review the URL and tailnet policy before using any persistent form.
4. Open the reported `https://...ts.net` address on an authorized phone, sign in with that device's ForgeRadar account, and verify that owner/member isolation and previews behave as expected. Do not treat a reachable page alone as a security test.

ForgeRadar checks the exact configured host, requires a local-loopback proxy connection, rejects mismatched request origins, uses a `Secure`, `HttpOnly`, `SameSite=Strict` cookie for HTTPS tailnet sessions, and still enforces account authorization on APIs and preview assets. The simulated test covers these checks but cannot prove a real Tailscale deployment works until Tailscale is installed and the owner authorizes activation. The existing Render dashboard is a separate legacy owner bridge and does not make local V3 accounts remotely available.

If the laptop is off, the local engine and private Serve target are offline. This free local-first arrangement cannot promise 24/7 availability without an always-on host. Do not use a temporary public tunnel as a substitute for a private tailnet.
