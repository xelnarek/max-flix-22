# Hosting the Paleciaki PvP WebSocket service

The public GitHub Pages site is static. It cannot host the `/pvp-ws` WebSocket endpoint itself. PvP practice with the local bot works without a network service; online rooms require this small Node service to be deployed separately.

## Runtime

- Node.js 24 or newer.

## Container deployment

The repository includes a minimal production `Dockerfile` for hosts that deploy containers:

```bash
docker build -t paleciaki-pvp .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e PVP_ALLOWED_ORIGINS=https://xelnarek.github.io \
  paleciaki-pvp
```

The platform should expose the container's HTTP port and terminate TLS so the public browser client can connect using `wss://`. Configure the public WebSocket URL in the GitHub Actions variable described below. The HTTP health probe is `/healthz`.


- Install the repository dependencies with `npm ci`.
- Start the service with `npm run pvp:server`.
- The host supplies `PORT`; locally the server uses `PVP_PORT` or 8080.
- Health endpoint: `GET /healthz`.
- WebSocket endpoint: `/pvp-ws` (the reverse proxy must support WebSocket upgrade).

## Required production settings

Set `NODE_ENV=production` and `PVP_ALLOWED_ORIGINS` to a comma-separated exact origin allow-list, for example:

```text
PVP_ALLOWED_ORIGINS=https://xelnarek.github.io
```

Add any real custom game domain separately. The server rejects browser WebSocket upgrades from origins outside this list. Do not put private credentials in the static website bundle.

## Configure the static client

After deploying the service with TLS, set the GitHub repository Actions variable `VITE_PVP_WS_URL` to the public secure endpoint:

```text
wss://YOUR-PVP-HOST.example.com/pvp-ws
```

The deploy workflow passes that variable into the Vite production build. Because it is a public endpoint, use a repository *variable*, not a secret. Re-run the GitHub Pages deployment after setting it.

Without the variable, the client deliberately disables online room creation on GitHub Pages and explains that the online service is not configured. Local bot practice remains available.

## Current multiplayer scope and operational limits

The server runs an authoritative 1v1 simulation at 30 Hz, validates/clamps player input, limits WebSocket payload size and message rate, uses six-character invite codes, requires both players to agree to a rematch, and rejects production origins not explicitly allowed. It closes the match if a player disconnects; reconnect/resume is not implemented yet.

This is an MVP room server, not a full account/authentication or anti-cheat platform. For public ranked play, add authenticated room ownership, match result persistence, queue-based matchmaking, reconnect tokens, server metrics, abuse monitoring and multi-device latency testing before enabling rankings or rewards.
