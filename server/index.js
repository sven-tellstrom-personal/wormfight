import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  TICK_MS,
  PLAYER_COLORS,
  EXPLOSION_LIFE_MS,
} from "../shared/constants.js";
import { GameEngine } from "./gameEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const engine = new GameEngine();
const socketToPlayer = new Map();

function getLobbyState() {
  return {
    phase: engine.phase,
    players: engine.players.map((p) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      colors: p.colors,
      lives: p.lives,
      hits: p.hits,
    })),
    maxPlayers: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS_TO_START,
    canStart:
      engine.phase === "lobby" &&
      engine.players.length >= MIN_PLAYERS_TO_START,
  };
}

function broadcastLobby() {
  io.emit("lobby", getLobbyState());
}

function broadcastState(snapshot) {
  io.emit("state", snapshot);
}

function findPlayer(socketId) {
  return engine.players.find((p) => p.id === socketId);
}

function removePlayer(socketId) {
  if (!findPlayer(socketId)) return;

  engine.players = engine.players.filter((p) => p.id !== socketId);
  engine.players.forEach((p, index) => {
    p.slot = index;
    p.spawnIndex = index;
    p.colors = PLAYER_COLORS[index % PLAYER_COLORS.length];
  });

  if (engine.phase === "running" || engine.phase === "ending") {
    const active = engine.players.filter((p) => p.lives > 0);
    if (engine.players.length >= 2 && active.length <= 1) {
      engine.phase = "ending";
      engine.winner = active[0] || null;
      engine.endingUntil = Date.now() + EXPLOSION_LIFE_MS;
    }
  }

  if (engine.players.length === 0) {
    engine.resetToLobby();
  }

  socketToPlayer.delete(socketId);
  broadcastLobby();
}

io.on("connection", (socket) => {
  socket.emit("welcome", {
    yourId: null,
    lobby: getLobbyState(),
  });

  socket.on("join", ({ name }) => {
    if (engine.phase !== "lobby" && engine.phase !== "gameover") {
      socket.emit("error", { message: "Game in progress. Wait for the next round." });
      return;
    }

    if (engine.players.length >= MAX_PLAYERS) {
      socket.emit("error", { message: "Room is full (20 players max)." });
      return;
    }

    if (socketToPlayer.has(socket.id)) {
      socket.emit("error", { message: "Already joined." });
      return;
    }

    const trimmed = String(name || "Worm").trim().slice(0, 16) || "Worm";
    const slot = engine.players.length;
    const player = engine.createPlayer(socket.id, trimmed, slot);
    engine.players.push(player);
    socketToPlayer.set(socket.id, player.id);

    if (engine.phase === "gameover") {
      engine.phase = "lobby";
    }

    socket.emit("joined", {
      yourId: socket.id,
      player: {
        id: player.id,
        name: player.name,
        slot: player.slot,
        colors: player.colors,
      },
      lobby: getLobbyState(),
    });

    broadcastLobby();
  });

  socket.on("start", () => {
    if (engine.phase !== "lobby" && engine.phase !== "gameover") return;
    if (engine.players.length < MIN_PLAYERS_TO_START) return;
    if (!findPlayer(socket.id)) return;

    engine.startMatch();
    broadcastState(engine.getSnapshot(Date.now()));
    broadcastLobby();
  });

  socket.on("rematch", () => {
    if (engine.phase !== "gameover") return;
    if (!findPlayer(socket.id)) return;
    if (engine.players.length < MIN_PLAYERS_TO_START) return;

    engine.startMatch();
    broadcastState(engine.getSnapshot(Date.now()));
    broadcastLobby();
  });

  socket.on("input", ({ turnLeft, turnRight }) => {
    const player = findPlayer(socket.id);
    if (!player || engine.phase !== "running") return;

    player.turnLeftHeld = Boolean(turnLeft);
    player.turnRightHeld = Boolean(turnRight);
  });

  socket.on("disconnect", () => {
    removePlayer(socket.id);
  });
});

setInterval(() => {
  if (engine.phase === "lobby" || engine.players.length === 0) return;

  const snapshot = engine.tick();
  broadcastState(snapshot);

  if (engine.phase === "gameover") {
    broadcastLobby();
  }
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`Wormfight server running on http://localhost:${PORT}`);
});
