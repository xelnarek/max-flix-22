# Deploy the Paleciaki PvP WebSocket service

The browser game is hosted as a static GitHub Pages site. The multiplayer room server must run separately because GitHub Pages cannot host a persistent WebSocket endpoint.

## Prepared deployment

The repository now includes:

- `Dockerfile`: a small Node 24 image with only the `ws` runtime dependency.
- `render.yaml`: a Render Blueprint for one always-on web service in Frankfurt.
- `GET /healthz`: HTTP health check.
- `wss://<service>.onrender.com/pvp-ws`: secure WebSocket endpoint after deployment.

The Blueprint sets `NODE_ENV=production` and `PVP_ALLOWED_ORIGINS=https://xelnarek.github.io`, which restricts browser WebSocket upgrades to the published game origin. It enables deploys after GitHub checks pass and uses the Starter/0.5 CPU, 512 MB compute plan.

## Deploy with Render

1. Connect your Render account to ChatGPT using the Render connection prompt. Do not paste your password or API key into this chat.
2. In Render, create a new **Blueprint** and select GitHub repository `xelnarek/max-flix-22`, branch `main`.
3. Render detects `render.yaml`. Review the proposed service `paleciaki-pvp`, Frankfurt region, health path `/healthz`, and Starter compute plan. Approve creation only after reviewing the price shown in your account.
4. Wait for the first deployment to finish. Open `https://<service-name>.onrender.com/healthz`. A healthy response looks like:
   `{"ok":true,"service":"paleciaki-pvp","websocketPath":"/pvp-ws"}`
5. Copy the hostname Render assigned to the service. The browser endpoint is the same hostname with `wss://` and path `/pvp-ws`.

## Why Starter instead of Free

Render's Free web services can spin down after 15 minutes without inbound traffic, including WebSocket traffic. The next connection can take about a minute to wake the service. That is unsuitable for a responsive real-time PvP lobby. The Starter plan stays running; current listed compute price is approximately USD 7/month, in addition to any applicable metered usage. Check the exact amount shown by Render before approving. Sources: [Render Free instance limits](https://render.com/docs/free) and [Render pricing](https://render.com/pricing).

## Connect the website to the deployed server

After Render confirms the exact public hostname, set the website build variable `VITE_PVP_WS_URL` to:

```text
wss://<exact-render-hostname>.onrender.com/pvp-ws
```

The existing GitHub Pages workflow already passes `vars.VITE_PVP_WS_URL` into the Vite build. This variable is a public endpoint, not a secret. Re-run the Pages deployment after it is set.

## Verification checklist

- `GET /healthz` returns HTTP 200.
- Browser WebSocket handshake to `wss://<host>/pvp-ws` succeeds from the game origin.
- Device A creates a room and receives a six-character code.
- Device B joins using the code.
- Both players mark ready; the server starts the match.
- Movement, manual aim, firing, abilities, round results and rematches synchronize.
- Disconnecting one player ends the room safely.

The current service is an authoritative 1v1 MVP at 30 Hz. It does not yet restore an active match after a disconnect and is not a ranked/anti-cheat platform. Do not publish rankings or paid rewards until authentication, persistent match results, reconnect handling and abuse controls are added.
