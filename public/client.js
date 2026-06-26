(() => {
  "use strict";

  const SEGMENT_RADIUS = 3;
  const EXPLOSION_PARTICLES = 28;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const lobbyEl = document.getElementById("lobby");
  const gameScreenEl = document.getElementById("game-screen");
  const joinForm = document.getElementById("join-form");
  const waitingMsg = document.getElementById("waiting-msg");
  const nameInput = document.getElementById("name-input");
  const joinBtn = document.getElementById("join-btn");
  const joinError = document.getElementById("join-error");
  const playerCountEl = document.getElementById("player-count");
  const playerListEl = document.getElementById("player-list");
  const startBtn = document.getElementById("start-btn");
  const rematchBtn = document.getElementById("rematch-btn");
  const connectionStatus = document.getElementById("connection-status");
  const scoreboardEl = document.getElementById("scoreboard");
  const youPanel = document.getElementById("you-panel");
  const youStats = document.getElementById("you-stats");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const turnLeftBtn = document.getElementById("turn-left");
  const turnRightBtn = document.getElementById("turn-right");

  let socket;
  let yourId = null;
  let joined = false;
  let phase = "lobby";
  let latestState = null;
  let localParticles = [];
  let seenExplosions = new Set();
  let inputState = { turnLeft: false, turnRight: false };
  let animationId = null;

  function connect() {
    socket = io({ transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      connectionStatus.textContent = "Connected";
      connectionStatus.className = "connection online";
    });

    socket.on("disconnect", () => {
      connectionStatus.textContent = "Disconnected";
      connectionStatus.className = "connection offline";
      joined = false;
      yourId = null;
      joinForm.classList.remove("hidden");
      waitingMsg.classList.add("hidden");
      showLobby();
    });

    socket.on("welcome", () => {
      connectionStatus.textContent = "Connected";
      connectionStatus.className = "connection online";
    });

    socket.on("error", ({ message }) => {
      showJoinError(message);
    });

    socket.on("joined", ({ yourId: id, lobby }) => {
      yourId = id;
      joined = true;
      joinError.classList.add("hidden");
      joinForm.classList.add("hidden");
      waitingMsg.classList.remove("hidden");
      updateLobby(lobby);
    });

    socket.on("lobby", updateLobby);

    socket.on("state", (state) => {
      latestState = state;
      phase = state.phase;
      syncExplosions(state.explosions || []);

      if (state.phase === "running" || state.phase === "ending") {
        showGame();
        updateScoreboard(state);
      }

      if (state.phase === "gameover") {
        showGameOver(state);
        updateLobbyFromState(state);
      }
    });
  }

  function showJoinError(message) {
    joinError.textContent = message;
    joinError.classList.remove("hidden");
  }

  function updateLobby(lobby) {
    playerCountEl.textContent = `${lobby.players.length} / ${lobby.maxPlayers} players`;
    playerListEl.innerHTML = lobby.players
      .map(
        (p) => `
        <li class="player-row${p.id === yourId ? " is-you" : ""}">
          <span class="swatch" style="background:${p.colors.head}"></span>
          <span class="player-name">${escapeHtml(p.name)}${p.id === yourId ? " (you)" : ""}</span>
        </li>`
      )
      .join("");

    const inLobby = lobby.phase === "lobby" || lobby.phase === "gameover";

    if (joined && inLobby && lobby.canStart) {
      startBtn.classList.toggle("hidden", lobby.phase === "gameover");
      rematchBtn.classList.toggle("hidden", lobby.phase !== "gameover");
      startBtn.disabled = false;
      rematchBtn.disabled = false;
    } else {
      startBtn.classList.add("hidden");
      rematchBtn.classList.add("hidden");
    }

    if (lobby.phase === "running" || lobby.phase === "ending") {
      showGame();
    } else if (!joined) {
      showLobby();
    }
  }

  function updateLobbyFromState(state) {
    playerCountEl.textContent = `${state.players.length} / 20 players`;
    if (joined) {
      rematchBtn.classList.remove("hidden");
      rematchBtn.disabled = state.players.length < 2;
    }
  }

  function showLobby() {
    lobbyEl.classList.remove("hidden");
    gameScreenEl.classList.add("hidden");
    overlay.classList.add("hidden");
    stopRenderLoop();
  }

  function showGame() {
    lobbyEl.classList.add("hidden");
    gameScreenEl.classList.remove("hidden");
    overlay.classList.add("hidden");
    startRenderLoop();
  }

  function showGameOver(state) {
    overlay.classList.remove("hidden");
    if (state.winner) {
      const isYou = state.winner.id === yourId;
      overlayTitle.textContent = isYou ? "You win!" : `${state.winner.name} wins!`;
      overlayMessage.textContent = `${state.winner.name} scored ${state.winner.hits} hits.`;
    } else {
      overlayTitle.textContent = "Draw!";
      overlayMessage.textContent = "Everyone crashed out.";
    }
  }

  function updateScoreboard(state) {
    const sorted = [...state.players].sort((a, b) => b.hits - a.hits || b.lives - a.lives);
    scoreboardEl.innerHTML = sorted
      .map((p) => {
        const isYou = p.id === yourId;
        return `
          <li class="score-row${isYou ? " is-you" : ""}${p.alive ? "" : " eliminated"}">
            <span class="swatch" style="background:${p.colors.head}"></span>
            <span class="score-name">${escapeHtml(p.name)}</span>
            <span class="score-meta">${p.lives}♥ · ${p.hits} hits</span>
          </li>`;
      })
      .join("");

    const you = state.players.find((p) => p.id === yourId);
    if (you) {
      youPanel.classList.remove("hidden");
      youStats.textContent = `${you.lives} lives · ${you.hits} hits`;
      youPanel.querySelector(".you-label").style.color = you.colors.head;
    }
  }

  function syncExplosions(explosions) {
    explosions.forEach((e, index) => {
      const key = `${Math.round(e.x)}:${Math.round(e.y)}:${e.total - e.remaining}`;
      if (seenExplosions.has(key)) return;
      if (e.remaining > e.total * 0.85) {
        seenExplosions.add(key);
        spawnLocalExplosion(e.x, e.y, e.colors);
      }
    });

    if (seenExplosions.size > 200) {
      seenExplosions.clear();
    }
  }

  function spawnLocalExplosion(x, y, colors) {
    const palette = [colors.head, colors.body, "#fef08a", "#ffffff"];
    for (let i = 0; i < EXPLOSION_PARTICLES; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 4.2;
      const isCore = i < 4;
      localParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 450,
        maxLife: 450,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: isCore ? 4 + Math.random() * 3 : 2 + Math.random() * 3.5,
      });
    }
  }

  function updateLocalParticles(dt) {
    localParticles = localParticles
      .map((p) => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * 0.92,
        vy: p.vy * 0.92,
        life: p.life - dt,
      }))
      .filter((p) => p.life > 0);
  }

  function drawCircle(x, y, radius, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!latestState) return;

    ctx.fillStyle = "#1a2332";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    latestState.players.forEach((player) => {
      if (!player.alive || !player.snake.length) return;
      player.snake.forEach((seg, i) => {
        const color = i === 0 ? player.colors.head : player.colors.body;
        drawCircle(seg.x, seg.y, SEGMENT_RADIUS, color);
      });
    });

    (latestState.explosions || []).forEach((e) => {
      const alpha = Math.max(0, e.remaining / e.total);
      drawCircle(e.x, e.y, 6 * alpha, e.colors.head, alpha * 0.5);
    });

    localParticles.forEach((p) => {
      const alpha = p.life / p.maxLife;
      const radius = p.size * (0.35 + alpha * 0.65);
      drawCircle(p.x, p.y, radius, p.color, alpha);
    });
  }

  let lastFrame = performance.now();

  function frame(now) {
    const dt = now - lastFrame;
    lastFrame = now;
    updateLocalParticles(dt);
    render();
    animationId = requestAnimationFrame(frame);
  }

  function startRenderLoop() {
    if (animationId) return;
    lastFrame = performance.now();
    animationId = requestAnimationFrame(frame);
  }

  function stopRenderLoop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function sendInput() {
    if (!socket || !joined) return;
    socket.emit("input", inputState);
  }

  function setTurn(side, active) {
    if (phase !== "running") return;
    if (side === "left") inputState.turnLeft = active;
    else inputState.turnRight = active;
    sendInput();
  }

  function bindHoldButton(btn, side) {
    const press = (e) => {
      e.preventDefault();
      setTurn(side, true);
    };
    const release = () => setTurn(side, false);

    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
    btn.addEventListener("mouseleave", release);
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release);
    btn.addEventListener("touchcancel", release);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!socket?.connected) {
      showJoinError("Not connected to server.");
      return;
    }
    socket.emit("join", { name: nameInput.value });
  });

  startBtn.addEventListener("click", () => socket.emit("start"));
  rematchBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    socket.emit("rematch");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "1") {
      e.preventDefault();
      setTurn("left", true);
    }
    if (e.key === "2") {
      e.preventDefault();
      setTurn("right", true);
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "1") setTurn("left", false);
    if (e.key === "2") setTurn("right", false);
  });

  window.addEventListener("blur", () => {
    inputState.turnLeft = false;
    inputState.turnRight = false;
    sendInput();
  });

  setInterval(sendInput, 100);

  bindHoldButton(turnLeftBtn, "left");
  bindHoldButton(turnRightBtn, "right");

  connect();
  showLobby();
})();
