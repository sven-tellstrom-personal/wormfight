import {
  CANVAS_SIZE,
  TURN_STEPS,
  TURN_ANGLE,
  SPEED,
  INITIAL_LENGTH,
  STARTING_LIVES,
  INVINCIBLE_MS,
  EXPLOSION_LIFE_MS,
  SELF_COLLISION_SKIP,
  HIT_DIST_SQ,
  PLAYER_COLORS,
  getSpawnPositions,
} from "../shared/constants.js";
import {
  sweptHitsSnake,
  sweptHeadsCollide,
  hitsWall,
  clampToWall,
  collisionPoint,
  pointToSegmentDistSq,
  segmentSegmentDistSq,
} from "./collision.js";

function directionVector(index) {
  const angle = index * TURN_ANGLE;
  return {
    x: Math.cos(angle) * SPEED,
    y: Math.sin(angle) * SPEED,
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

export class GameEngine {
  constructor() {
    this.players = [];
    this.phase = "lobby";
    this.explosions = [];
    this.winner = null;
    this.endingUntil = 0;
    this.tickCount = 0;
  }

  createPlayer(id, name, slot) {
    return {
      id,
      name,
      slot,
      snake: [],
      directionIndex: 0,
      nextDirectionIndex: 0,
      lives: STARTING_LIVES,
      hits: 0,
      invincibleUntil: 0,
      turnLeftHeld: false,
      turnRightHeld: false,
      colors: PLAYER_COLORS[slot % PLAYER_COLORS.length],
      spawnIndex: slot,
    };
  }

  setPlayers(playerList) {
    this.players = playerList;
  }

  isActive(player) {
    return player.lives > 0;
  }

  isVulnerable(player, now) {
    return this.isActive(player) && now >= player.invincibleUntil;
  }

  rotateLeft(player) {
    player.nextDirectionIndex =
      (player.nextDirectionIndex - 1 + TURN_STEPS) % TURN_STEPS;
  }

  rotateRight(player) {
    player.nextDirectionIndex = (player.nextDirectionIndex + 1) % TURN_STEPS;
  }

  placePlayerAtSpawn(player, spawns) {
    const spawn = spawns[player.spawnIndex];
    player.snake = buildSnake(spawn.x, spawn.y, spawn.dir);
    player.directionIndex = spawn.dir;
    player.nextDirectionIndex = spawn.dir;
    player.turnLeftHeld = false;
    player.turnRightHeld = false;
  }

  respawnPlayer(player, spawns, now) {
    this.placePlayerAtSpawn(player, spawns);
    player.invincibleUntil = now + INVINCIBLE_MS;
  }

  addExplosion(x, y, colors) {
    this.explosions.push({
      x,
      y,
      colors,
      until: Date.now() + EXPLOSION_LIFE_MS,
    });
  }

  startMatch() {
    const spawns = getSpawnPositions(this.players.length);
    const now = Date.now();

    this.players.forEach((player, index) => {
      player.slot = index;
      player.spawnIndex = index;
      player.lives = STARTING_LIVES;
      player.hits = 0;
      player.invincibleUntil = 0;
      player.colors = PLAYER_COLORS[index % PLAYER_COLORS.length];
      this.placePlayerAtSpawn(player, spawns);
    });

    this.explosions = [];
    this.winner = null;
    this.endingUntil = 0;
    this.tickCount = 0;
    this.phase = "running";
  }

  penalizePlayer(player, impactPoint, spawns, now) {
    const point = impactPoint || player.snake[0];
    if (point) {
      this.addExplosion(point.x, point.y, player.colors);
    }

    player.lives -= 1;
    player.turnLeftHeld = false;
    player.turnRightHeld = false;
    player.snake = [];

    if (player.lives > 0) {
      this.respawnPlayer(player, spawns, now);
    }
  }

  registerHit(attacker, victim, impactPoint, spawns, now) {
    if (!this.isVulnerable(victim, now)) return false;
    attacker.hits += 1;
    this.penalizePlayer(victim, impactPoint || victim.snake[0], spawns, now);
    return true;
  }

  markSkipMove(pending, player) {
    const entry = pending.find((m) => m.player === player);
    if (entry) entry.skipMove = true;
  }

  hitsSelfPlayer(player, oldHead, newHead) {
    for (let i = SELF_COLLISION_SKIP; i < player.snake.length; i += 1) {
      if (
        pointToSegmentDistSq(player.snake[i], oldHead, newHead) < HIT_DIST_SQ
      ) {
        return player.snake[i];
      }
    }
    for (let i = SELF_COLLISION_SKIP; i < player.snake.length - 1; i += 1) {
      if (
        segmentSegmentDistSq(
          oldHead,
          newHead,
          player.snake[i],
          player.snake[i + 1]
        ) < HIT_DIST_SQ
      ) {
        return player.snake[i];
      }
    }
    return null;
  }

  tick() {
    const now = Date.now();
    this.explosions = this.explosions.filter((e) => e.until > now);

    if (this.phase === "lobby" || this.phase === "gameover") {
      return this.getSnapshot(now);
    }

    if (this.phase === "ending") {
      if (now >= this.endingUntil && this.explosions.length === 0) {
        this.phase = "gameover";
      }
      return this.getSnapshot(now);
    }

    const spawns = getSpawnPositions(this.players.length);

    const pending = this.players
      .filter((p) => this.isActive(p))
      .map((p) => {
        if (p.turnLeftHeld) this.rotateLeft(p);
        if (p.turnRightHeld) this.rotateRight(p);
        p.directionIndex = p.nextDirectionIndex;
        const move = directionVector(p.directionIndex);
        const head = p.snake[0];
        const oldHead = { x: head.x, y: head.y };
        const newHead = { x: head.x + move.x, y: head.y + move.y };
        return { player: p, oldHead, newHead, skipMove: false };
      });

    const respawned = new Set();

    for (const m of pending) {
      const selfHit = this.hitsSelfPlayer(m.player, m.oldHead, m.newHead);
      if (hitsWall(m.newHead) || selfHit) {
        const impact = hitsWall(m.newHead)
          ? clampToWall(m.newHead)
          : selfHit || m.newHead;
        this.penalizePlayer(m.player, impact, spawns, now);
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
        if (this.isVulnerable(a.player, now)) {
          this.penalizePlayer(a.player, impact, spawns, now);
          a.skipMove = true;
          respawned.add(a.player);
        }
        if (this.isVulnerable(b.player, now)) {
          this.penalizePlayer(b.player, impact, spawns, now);
          b.skipMove = true;
          respawned.add(b.player);
        }
      }
    }

    for (const m of pending) {
      if (m.skipMove) continue;
      for (const other of this.players) {
        if (
          other === m.player ||
          !this.isActive(other) ||
          respawned.has(other)
        ) {
          continue;
        }
        if (!this.isVulnerable(other, now)) continue;

        const otherEntry = pending.find((entry) => entry.player === other);
        if (otherEntry && !otherEntry.skipMove) {
          const headPathHit = sweptHitsSnake(m.oldHead, m.newHead, [
            otherEntry.oldHead,
            otherEntry.newHead,
          ]);
          if (headPathHit) {
            this.registerHit(m.player, other, headPathHit, spawns, now);
            respawned.add(other);
            this.markSkipMove(pending, other);
            continue;
          }
        }

        const bodyHit = sweptHitsSnake(m.oldHead, m.newHead, other.snake);
        if (bodyHit) {
          this.registerHit(m.player, other, bodyHit, spawns, now);
          respawned.add(other);
          this.markSkipMove(pending, other);
        }
      }
    }

    for (const m of pending) {
      if (m.skipMove || !this.isActive(m.player)) continue;
      m.player.snake.unshift(m.newHead);
      m.player.snake.pop();
    }

    this.tickCount += 1;

    const active = this.players.filter((p) => this.isActive(p));
    if (active.length <= 1 && this.players.length >= 2) {
      this.phase = "ending";
      this.winner = active[0] || null;
      this.endingUntil = now + EXPLOSION_LIFE_MS;
    }

    return this.getSnapshot(now);
  }

  getSnapshot(now) {
    return {
      phase: this.phase,
      tick: this.tickCount,
      canvasSize: CANVAS_SIZE,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        slot: p.slot,
        lives: p.lives,
        hits: p.hits,
        colors: p.colors,
        snake: p.snake,
        alive: this.isActive(p),
      })),
      explosions: this.explosions.map((e) => ({
        x: e.x,
        y: e.y,
        colors: e.colors,
        remaining: e.until - now,
        total: EXPLOSION_LIFE_MS,
      })),
      winner: this.winner
        ? { id: this.winner.id, name: this.winner.name, hits: this.winner.hits }
        : null,
    };
  }

  resetToLobby() {
    this.phase = "lobby";
    this.explosions = [];
    this.winner = null;
    this.endingUntil = 0;
    this.players.forEach((p) => {
      p.snake = [];
      p.lives = STARTING_LIVES;
      p.hits = 0;
      p.turnLeftHeld = false;
      p.turnRightHeld = false;
    });
  }
}
