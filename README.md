# Wormfight

Online multiplayer worm combat for up to **20 players**. Ram opponents to score hits — each player has 3 lives. Last worm standing wins.

## Play locally

```bash
npm install
npm start
```

Open **http://localhost:3000** in multiple browser tabs or devices on the same network.

1. Enter a name and click **Join game**
2. When at least 2 players are in the lobby, anyone can click **Start match**
3. Hold **1** / **2** (or on-screen buttons) to turn left/right

## How it works

- **Server-authoritative** game loop (Node.js + Socket.io)
- Clients send input only; the server runs collisions, lives, respawns, and explosions
- Swept collision detection prevents worms passing through each other
- Up to 20 players with unique colors, spawned around the arena

## Deploy online

Firebase Hosting serves static files only — **multiplayer requires the Node server** for WebSockets.

### Option A: Cloud Run (recommended)

```bash
gcloud run deploy wormfight \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

Or build the Docker image:

```bash
docker build -t wormfight .
docker run -p 8080:8080 wormfight
```

### Option B: Any Node host

Set `PORT` and run `npm start`. Render, Railway, Fly.io, and VPS providers all work.

### Firebase Hosting (static only)

```bash
npx -y firebase-tools@latest deploy --only hosting
```

This deploys the client UI to `https://wormfight-2fac5.web.app`, but **without a running server it cannot connect for multiplayer**. Use Cloud Run for the full game, or point a custom domain at your Node server.

## Project structure

```
shared/constants.js   Game constants (shared)
server/index.js       Express + Socket.io server
server/gameEngine.js  Authoritative game logic
server/collision.js   Swept collision helpers
public/               Client (HTML, CSS, JS)
legacy/               Original local 2-player version
```

## Legacy local 2-player

The original same-keyboard version is in `legacy/` — open `legacy/index.html` in a browser (no server needed).
