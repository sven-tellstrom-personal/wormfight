export const CANVAS_SIZE = 400;
export const TURN_STEPS = 32;
export const TURN_ANGLE = (Math.PI * 2) / TURN_STEPS;
export const SPEED = 2;
export const SEGMENT_RADIUS = 3;
export const INITIAL_LENGTH = 16;
export const TICK_MS = 50;
export const SELF_COLLISION_SKIP = 6;
export const STARTING_LIVES = 3;
export const INVINCIBLE_MS = 2000;
export const EXPLOSION_LIFE_MS = 450;
export const MAX_PLAYERS = 20;
export const MIN_PLAYERS_TO_START = 2;

export const HIT_DIST = SEGMENT_RADIUS * 1.5;
export const HIT_DIST_SQ = HIT_DIST * HIT_DIST;
export const HEAD_COLLISION_DIST = SEGMENT_RADIUS * 2;
export const HEAD_COLLISION_SQ = HEAD_COLLISION_DIST * HEAD_COLLISION_DIST;

export const PLAYER_COLORS = [
  { head: "#22c55e", body: "#4ade80" },
  { head: "#38bdf8", body: "#7dd3fc" },
  { head: "#f472b6", body: "#f9a8d4" },
  { head: "#fb923c", body: "#fdba74" },
  { head: "#a78bfa", body: "#c4b5fd" },
  { head: "#facc15", body: "#fde047" },
  { head: "#2dd4bf", body: "#5eead4" },
  { head: "#f87171", body: "#fca5a5" },
  { head: "#818cf8", body: "#a5b4fc" },
  { head: "#4ade80", body: "#86efac" },
  { head: "#e879f9", body: "#f0abfc" },
  { head: "#34d399", body: "#6ee7b7" },
  { head: "#60a5fa", body: "#93c5fd" },
  { head: "#fbbf24", body: "#fcd34d" },
  { head: "#c084fc", body: "#d8b4fe" },
  { head: "#fb7185", body: "#fda4af" },
  { head: "#14b8a6", body: "#2dd4bf" },
  { head: "#a3e635", body: "#bef264" },
  { head: "#f97316", body: "#fdba74" },
  { head: "#6366f1", body: "#818cf8" },
];

export function getSpawnPositions(count) {
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const radius = CANVAS_SIZE * 0.34;
  const positions = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const outward = Math.atan2(y - cy, x - cx);
    const dir =
      Math.round((outward / (Math.PI * 2)) * TURN_STEPS + TURN_STEPS) %
      TURN_STEPS;
    positions.push({ x, y, dir });
  }

  return positions;
}
