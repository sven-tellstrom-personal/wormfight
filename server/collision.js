import {
  HIT_DIST_SQ,
  HEAD_COLLISION_SQ,
  SEGMENT_RADIUS,
  CANVAS_SIZE,
} from "../shared/constants.js";

export function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function pointToSegmentDistSq(point, segStart, segEnd) {
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

export function segmentSegmentDistSq(a1, a2, b1, b2) {
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

export function sweptHitsSnake(oldHead, newHead, snake) {
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

export function sweptHeadsCollide(a, b) {
  return (
    segmentSegmentDistSq(a.oldHead, a.newHead, b.oldHead, b.newHead) <
    HEAD_COLLISION_SQ
  );
}

export function hitsWall(head) {
  return (
    head.x - SEGMENT_RADIUS < 0 ||
    head.x + SEGMENT_RADIUS > CANVAS_SIZE ||
    head.y - SEGMENT_RADIUS < 0 ||
    head.y + SEGMENT_RADIUS > CANVAS_SIZE
  );
}

export function clampToWall(point) {
  return {
    x: Math.max(SEGMENT_RADIUS, Math.min(CANVAS_SIZE - SEGMENT_RADIUS, point.x)),
    y: Math.max(SEGMENT_RADIUS, Math.min(CANVAS_SIZE - SEGMENT_RADIUS, point.y)),
  };
}

export function collisionPoint(a, b) {
  return {
    x: (a.newHead.x + b.newHead.x) / 2,
    y: (a.newHead.y + b.newHead.y) / 2,
  };
}
