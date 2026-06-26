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

Firebase Hosting serves static files only — **multiplayer requires Cloud Run** for WebSockets.

### Prerequisites

1. [Install Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
2. Log in: `gcloud auth login`
3. **Enable billing** on project `wormfight-2fac5`:
   - [Firebase Console → Usage and billing](https://console.firebase.google.com/u/1/project/wormfight-2fac5/usage/details)
   - Or [GCP Billing](https://console.cloud.google.com/billing/linkedaccount?project=wormfight-2fac5)

Cloud Run has a generous free tier; a small game like this typically costs little or nothing.

### Deploy to Cloud Run

From the project folder:

```powershell
npm run deploy
```

Or use the script:

```powershell
.\scripts\deploy-cloudrun.ps1
```

Or manually:

```bash
gcloud config set project wormfight-2fac5
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy wormfight --source . --region europe-west1 --allow-unauthenticated --port 8080
```

Google prints a URL like `https://wormfight-xxxxx-ew.a.run.app` — that's your live multiplayer game.

### Firebase Hosting (static only)

```bash
npx -y firebase-tools@latest deploy --only hosting
```

This updates `https://wormfight-2fac5.web.app` but **will not run multiplayer** without Cloud Run.

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
