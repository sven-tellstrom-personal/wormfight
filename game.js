(() => {
  "use strict";

  const CANVAS_SIZE = 400;
  const TURN_STEPS = 32;
  const TURN_ANGLE = (Math.PI * 2) / TURN_STEPS;
  const SPEED = 2;
  const SEGMENT_RADIUS = 3;
  const INITIAL_LENGTH = 16;
  const TICK_MS = 50;
  const SELF_COLLISION_SKIP = 6;
  const STARTING_LIVES = 3;
  const INVINCIBLE_MS = 2000;
  const EXPLOSION_PARTICLES = 28;
  const EXPLOSION_LIFE_MS = 450;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const livesP1El = document.getElementById("lives-p1");
  const livesP2El = document.getElementById("lives-p2");
  const hitsP1El = document.getElementById("hits-p1");
  const hitsP2El = document.getElementById("hits-p2");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const playBtn = document.getElementById("play-btn");

  const MARGIN = SEGMENT_RADIUS + 2;
  const HIT_DIST = SEGMENT_RADIUS * 1.5;
  const HIT_DIST_SQ = HIT_DIST * HIT_DIST;
  const HEAD_COLLISION_DIST = SEGMENT_RADIUS * 2;
  const HEAD_COLLISION_SQ = HEAD_COLLISION_DIST * HEAD_COLLISION_DIST;

  const SPAWN = [
    { x: CANVAS_SIZE * 0.25, y: CANVAS_SIZE * 0.4, dir: 0 },
    { x: CANVAS_SIZE * 0.75, y: CANVAS_SIZE * 0.6, dir: TURN_STEPS / 2 },
  ];

  let players;
  let particles;
  let tickId;
  let endRoundTimer;
  let state;

  function createPlayer(config) {
    return {
      id: config.id,
      snake: [],
      directionIndex: config.directionIndex,
      nextDirectionIndex: config.directionIndex,
      lives: STARTING_LIVES,
      hits: 0,
      invincibleUntil: 0,
      turnLeftHeld: false,
      turnRightHeld: false,
      colors: config.colors,
      leftKey: config.leftKey,
      rightKey: config.rightKey,
      spawnIndex: config.spawnIndex,
    };
  }

  function initPlayers() {
    players = [
      createPlayer({
        id: 1,
        directionIndex: SPAWN[0].dir,
        colors: { head: "#22c55e", body: "#4ade80" },
        leftKey: "1",
        rightKey: "2",
        spawnIndex: 0,
      }),
      createPlayer({
        id: 2,
        directionIndex: SPAWN[1].dir,
        colors: { head: "#38bdf8", body: "#7dd3fc" },
        leftKey: "3",
        rightKey: "4",
        spawnIndex: 1,
      }),
    ];
  }

  function isActive(player) {
    return player.lives > 0;
  }

  function isVulnerable(player) {
    return isActive(player) && Date.now() >= player.invincibleUntil;
  }

  function directionVector(index) {
    const angle = index * TURN_ANGLE;
    return {
      x: Math.cos(angle) * SPEED,
      y: Math.sin(angle) * SPEED,
    };
  }

  function distSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function pointToSegmentDistSq(point, segStart, segEnd) {
    const abx = segEnd.x - segStart.x;
    const aby = segEnd.y - segStart.y;
    const apx = point.x - segStart.x;
    const apy = point.y - segStart.y;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return apx * apx + apy * apy;
    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));
    const dx = point.x - (segStart.x + abx * t);
    const dy = point.y - (segStart.y + aby * t);
    return dx * dx + dy * dy;
  }

  function segmentSegmentDistSq(a1, a2, b1, b2) {
    const d1x = a2.x - a1.x;
    const d1y = a2.y - a1.y;
    const d2x = b2.x - b1.x;
    const d2y = b2.y - b1.y;
    const rpx = a1.x - b1.x;
    const rpy = a1.y - b1.y;
    const a = d1x * d1x + d1y * d1y;
    const e = d2x * d2x + d2y * d2y;
    const dotD1D2 = d1x * d2x + d1y * d2y;
    const c = d1x * rpx + d1y * rpy;
    const f = d2x * rpx + d2y * rpy;

    let s = 0;
    let t = 0;

    if (a === 0 && e === 0) {
      return rpx * rpx + rpy * rpy;
    }

    if (a === 0) {
      s = 0;
      t = Math.max(0, Math.min(1, f / e));
    } else if (e === 0) {
      t = 0;
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const denom = a * e - dotD1D2 * dotD1D2;
      s = denom === 0 ? 0 : Math.max(0, Math.min(1, (c * e - f * dotD1D2) / denom));
      t = (dotD1D2 * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (dotD1D2 - c) / a));
      }
    }

    const dx = a1.x + d1x * s - (b1.x + d2x * t);
    const dy = a1.y + d1y * s - (b1.y + d2y * t);
    return dx * dx + dy * dy;
  }

  function sweptHitsSnake(oldHead, newHead, snake) {
    for (let i = 0; i < snake.length; i += 1) {
      if (pointToSegmentDistSq(snake[i], oldHead, newHead) < HIT_DIST_SQ) {
        return snake[i];
      }
    }
    for (let i = 0; i < snake.length - 1; i += 1) {
      if (
        segmentSegmentDistSq(oldHead, newHead, snake[i], snake[i + 1]) <
        HIT_DIST_SQ
      ) {
        return snake[i];
      }
    }
    return null;
  }

  function sweptHeadsCollide(a, b) {
    return (
      segmentSegmentDistSq(a.oldHead, a.newHead, b.oldHead, b.newHead) <
      HEAD_COLLISION_SQ
    );
  }

  function collisionPoint(a, b) {
    return {
      x: (a.newHead.x + b.newHead.x) / 2,
      y: (a.newHead.y + b.newHead.y) / 2,
    };
  }

  function buildSnake(startX, startY, directionIndex) {
    const move = directionVector(directionIndex);
    const snake = [];
    for (let i = 0; i < INITIAL_LENGTH; i += 1) {
      snake.push({
        x: startX - move.x * i,
        y: startY - move.y * i,
      });
    }
    return snake;
  }

  function placePlayerAtSpawn(player) {
    const spawn = SPAWN[player.spawnIndex];
    player.snake = buildSnake(spawn.x, spawn.y, spawn.dir);
    player.directionIndex = spawn.dir;
    player.nextDirectionIndex = spawn.dir;
    player.turnLeftHeld = false;
    player.turnRightHeld = false;
  }

  function respawnPlayer(player) {
    placePlayerAtSpawn(player);
    player.invincibleUntil = Date.now() + INVINCIBLE_MS;
  }

  function resetGame() {
    initPlayers();
    particles = [];
    players.forEach((p) => {
      p.lives = STARTING_LIVES;
      p.hits = 0;
      p.invincibleUntil = 0;
      placePlayerAtSpawn(p);
    });
    updateHud();
  }

  function updateHud() {
    livesP1El.textContent = String(players[0].lives);
    livesP2El.textContent = String(players[1].lives);
    hitsP1El.textContent = String(players[0].hits);
    hitsP2El.textContent = String(players[1].hits);
  }

  function showOverlay(title, message, btnText) {
    overlayTitle.textContent = title;
    overlayMessage.innerHTML = message;
    playBtn.textContent = btnText;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function rotateLeft(player) {
    player.nextDirectionIndex =
      (player.nextDirectionIndex - 1 + TURN_STEPS) % TURN_STEPS;
  }

  function rotateRight(player) {
    player.nextDirectionIndex = (player.nextDirectionIndex + 1) % TURN_STEPS;
  }

  function releaseAllTurns() {
    players.forEach((p) => {
      p.turnLeftHeld = false;
      p.turnRightHeld = false;
    });
  }

  function getPlayerByKey(key) {
    if (key === "1" || key === "2") return players[0];
    if (key === "3" || key === "4") return players[1];
    return null;
  }

  function pressTurn(player, side) {
    if (state !== "running" || !isActive(player)) return;
    if (side === "left") {
      if (!player.turnLeftHeld) rotateLeft(player);
      player.turnLeftHeld = true;
    } else {
      if (!player.turnRightHeld) rotateRight(player);
      player.turnRightHeld = true;
    }
  }

  function releaseTurn(player, side) {
    if (side === "left") player.turnLeftHeld = false;
    else player.turnRightHeld = false;
  }

  function bindHoldButton(btn, player, side) {
    const press = (e) => {
      e.preventDefault();
      pressTurn(player, side);
    };
    const release = () => releaseTurn(player, side);

    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
    btn.addEventListener("mouseleave", release);
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release);
    btn.addEventListener("touchcancel", release);
  }

  function hitsWall(head) {
    return (
      head.x - SEGMENT_RADIUS < 0 ||
      head.x + SEGMENT_RADIUS > CANVAS_SIZE ||
      head.y - SEGMENT_RADIUS < 0 ||
      head.y + SEGMENT_RADIUS > CANVAS_SIZE
    );
  }

  function hitsSelf(player, oldHead, newHead) {
    for (let i = SELF_COLLISION_SKIP; i < player.snake.length; i += 1) {
      if (pointToSegmentDistSq(player.snake[i], oldHead, newHead) < HIT_DIST_SQ) {
        return player.snake[i];
      }
    }
    for (let i = SELF_COLLISION_SKIP; i < player.snake.length - 1; i += 1) {
      if (
        segmentSegmentDistSq(oldHead, newHead, player.snake[i], player.snake[i + 1]) <
        HIT_DIST_SQ
      ) {
        return player.snake[i];
      }
    }
    return null;
  }

  function clampToWall(point) {
    return {
      x: Math.max(SEGMENT_RADIUS, Math.min(CANVAS_SIZE - SEGMENT_RADIUS, point.x)),
      y: Math.max(SEGMENT_RADIUS, Math.min(CANVAS_SIZE - SEGMENT_RADIUS, point.y)),
    };
  }

  function spawnExplosion(x, y, player) {
    const palette = [player.colors.head, player.colors.body, "#fef08a", "#ffffff"];
    for (let i = 0; i < EXPLOSION_PARTICLES; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 4.2;
      const isCore = i < 4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: EXPLOSION_LIFE_MS,
        maxLife: EXPLOSION_LIFE_MS,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: isCore ? 4 + Math.random() * 3 : 2 + Math.random() * 3.5,
      });
    }
  }

  function updateParticles() {
    particles = particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * 0.92,
        vy: p.vy * 0.92,
        life: p.life - TICK_MS,
      }))
      .filter((p) => p.life > 0);
  }

  function markSkipMove(pending, player) {
    const entry = pending.find((m) => m.player === player);
    if (entry) entry.skipMove = true;
  }

  function penalizePlayer(player, impactPoint) {
    const point = impactPoint || player.snake[0];
    if (point) spawnExplosion(point.x, point.y, player);

    player.lives -= 1;
    player.turnLeftHeld = false;
    player.turnRightHeld = false;
    player.snake = [];
    if (player.lives > 0) {
      respawnPlayer(player);
    }
  }

  function registerHit(attacker, victim, impactPoint) {
    if (!isVulnerable(victim)) return false;
    attacker.hits += 1;
    penalizePlayer(victim, impactPoint || victim.snake[0]);
    return true;
  }

  function tick() {
    if (state === "ending") {
      updateParticles();
      draw();
      if (particles.length === 0) {
        finishEndRound();
      }
      return;
    }

    const pending = players
      .filter((p) => isActive(p))
      .map((p) => {
        if (p.turnLeftHeld) rotateLeft(p);
        if (p.turnRightHeld) rotateRight(p);
        p.directionIndex = p.nextDirectionIndex;
        const move = directionVector(p.directionIndex);
        const head = p.snake[0];
        const oldHead = { x: head.x, y: head.y };
        const newHead = { x: head.x + move.x, y: head.y + move.y };
        return {
          player: p,
          oldHead,
          newHead,
          skipMove: false,
        };
      });

    const respawned = new Set();

    for (const m of pending) {
      const selfHit = hitsSelf(m.player, m.oldHead, m.newHead);
      if (hitsWall(m.newHead) || selfHit) {
        const impact = hitsWall(m.newHead)
          ? clampToWall(m.newHead)
          : selfHit || m.newHead;
        penalizePlayer(m.player, impact);
        m.skipMove = true;
        respawned.add(m.player);
      }
    }

    for (let i = 0; i < pending.length; i += 1) {
      for (let j = i + 1; j < pending.length; j += 1) {
        const a = pending[i];
        const b = pending[j];
        if (a.skipMove || b.skipMove) continue;
        if (!sweptHeadsCollide(a, b)) continue;

        const impact = collisionPoint(a, b);
        if (isVulnerable(a.player)) {
          penalizePlayer(a.player, impact);
          a.skipMove = true;
          respawned.add(a.player);
        }
        if (isVulnerable(b.player)) {
          penalizePlayer(b.player, impact);
          b.skipMove = true;
          respawned.add(b.player);
        }
      }
    }

    for (const m of pending) {
      if (m.skipMove) continue;
      for (const other of players) {
        if (other === m.player || !isActive(other) || respawned.has(other)) continue;
        if (!isVulnerable(other)) continue;

        const otherEntry = pending.find((entry) => entry.player === other);
        if (otherEntry && !otherEntry.skipMove) {
          const headPathHit = sweptHitsSnake(
            m.oldHead,
            m.newHead,
            [otherEntry.oldHead, otherEntry.newHead]
          );
          if (headPathHit) {
            registerHit(m.player, other, headPathHit);
            respawned.add(other);
            markSkipMove(pending, other);
            continue;
          }
        }

        const bodyHit = sweptHitsSnake(m.oldHead, m.newHead, other.snake);
        if (bodyHit) {
          registerHit(m.player, other, bodyHit);
          respawned.add(other);
          markSkipMove(pending, other);
        }
      }
    }

    for (const m of pending) {
      if (m.skipMove || !isActive(m.player)) continue;
      m.player.snake.unshift(m.newHead);
      m.player.snake.pop();
    }

    updateHud();
    updateParticles();

    const active = players.filter((p) => isActive(p));
    if (active.length < players.length) {
      beginEndRound();
      return;
    }

    draw();
  }

  function beginEndRound() {
    state = "ending";
    releaseAllTurns();
    draw();

    if (endRoundTimer) clearTimeout(endRoundTimer);
    endRoundTimer = setTimeout(finishEndRound, EXPLOSION_LIFE_MS);
  }

  function finishEndRound() {
    if (state !== "ending" && state !== "gameover") return;

    if (endRoundTimer) {
      clearTimeout(endRoundTimer);
      endRoundTimer = null;
    }

    state = "gameover";
    stopLoop();
    draw();

    const active = players.filter((p) => isActive(p));
    let title;
    let message;

    if (active.length === 1) {
      const winner = active[0];
      title = `Player ${winner.id} wins!`;
    } else {
      title = "Draw!";
    }

    message = `Hits — P1: <strong>${players[0].hits}</strong> · P2: <strong>${players[1].hits}</strong><br>Press Space or click Play to play again.`;
    showOverlay(title, message, "Play Again");
  }

  function drawParticles() {
    particles.forEach((p) => {
      const alpha = p.life / p.maxLife;
      const radius = p.size * (0.35 + alpha * 0.65);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = "#1a2332";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    players.forEach((player) => {
      if (!isActive(player)) return;

      player.snake.forEach((seg, i) => {
        const color = i === 0 ? player.colors.head : player.colors.body;
        drawCircle(seg.x, seg.y, SEGMENT_RADIUS, color);
      });
    });

    drawParticles();
  }

  function startLoop() {
    stopLoop();
    tickId = setInterval(tick, TICK_MS);
  }

  function stopLoop() {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
    if (endRoundTimer) {
      clearTimeout(endRoundTimer);
      endRoundTimer = null;
    }
  }

  function startGame() {
    resetGame();
    state = "running";
    hideOverlay();
    draw();
    startLoop();
  }

  function pauseGame() {
    if (state !== "running") return;
    state = "paused";
    releaseAllTurns();
    stopLoop();
    showOverlay("Paused", "Press Space or click Play to continue.", "Resume");
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "running";
    hideOverlay();
    startLoop();
  }

  function handlePlayButton() {
    if (state === "paused") resumeGame();
    else startGame();
  }

  document.addEventListener("keydown", (e) => {
    const key = e.key;

    if (key === " ") {
      e.preventDefault();
      if (state === "running") pauseGame();
      else if (state === "paused" || state === "idle" || state === "gameover") {
        if (state === "paused") resumeGame();
        else startGame();
      }
      return;
    }

    const player = getPlayerByKey(key);
    if (!player) return;

    if (key === player.leftKey) {
      e.preventDefault();
      if (!e.repeat) pressTurn(player, "left");
      else player.turnLeftHeld = true;
      return;
    }

    if (key === player.rightKey) {
      e.preventDefault();
      if (!e.repeat) pressTurn(player, "right");
      else player.turnRightHeld = true;
    }
  });

  document.addEventListener("keyup", (e) => {
    const player = getPlayerByKey(e.key);
    if (!player) return;
    if (e.key === player.leftKey) releaseTurn(player, "left");
    if (e.key === player.rightKey) releaseTurn(player, "right");
  });

  window.addEventListener("blur", releaseAllTurns);

  initPlayers();

  playBtn.addEventListener("click", handlePlayButton);
  bindHoldButton(document.getElementById("p1-left"), players[0], "left");
  bindHoldButton(document.getElementById("p1-right"), players[0], "right");
  bindHoldButton(document.getElementById("p2-left"), players[1], "left");
  bindHoldButton(document.getElementById("p2-right"), players[1], "right");

  state = "idle";
  particles = [];
  resetGame();
  draw();
  showOverlay(
    "Snake — 2 Players",
    "Ram your opponent to score hits.<br>P1: hold <strong>1</strong> / <strong>2</strong> · P2: hold <strong>3</strong> / <strong>4</strong><br>Each player has <strong>3 lives</strong>.",
    "Play"
  );
})();
