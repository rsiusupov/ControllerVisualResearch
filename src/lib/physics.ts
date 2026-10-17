/** Thrown cards: inertia, friction, and bouncing axis-aligned boxes. */

export const RESTITUTION = 0.72;
const DAMPING = 2.45;
const SLEEP_SPEED = 16;
const CELL = 200;

export type Body = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  invMass: number;
  awake: number;
};

export type SpatialHash = {
  cell: number;
  cols: number;
  rows: number;
  head: Int32Array;
  next: Int32Array;
};

export function createHash(count: number, width: number, height: number): SpatialHash {
  const cols = Math.max(1, Math.ceil(width / CELL));
  const rows = Math.max(1, Math.ceil(height / CELL));
  return {
    cell: CELL,
    cols,
    rows,
    head: new Int32Array(cols * rows),
    next: new Int32Array(Math.max(1, count)),
  };
}

export function prepareHash(hash: SpatialHash, count: number, width: number, height: number) {
  const cols = Math.max(1, Math.ceil(width / hash.cell));
  const rows = Math.max(1, Math.ceil(height / hash.cell));
  if (hash.head.length < cols * rows) hash.head = new Int32Array(cols * rows);
  if (hash.next.length < count) hash.next = new Int32Array(count);
  hash.cols = cols;
  hash.rows = rows;
}

function resolve(a: Body, b: Body, aLock: boolean, bLock: boolean) {
  const dx = b.x - a.x;
  const px = (a.w + b.w) * 0.5 - Math.abs(dx);
  if (px <= 0) return;
  const dy = b.y - a.y;
  const py = (a.h + b.h) * 0.5 - Math.abs(dy);
  if (py <= 0) return;

  let nx = 0;
  let ny = 0;
  let pen = 0;
  if (px < py) {
    nx = dx < 0 ? -1 : 1;
    pen = px;
  } else {
    ny = dy < 0 ? -1 : 1;
    pen = py;
  }

  const invA = aLock ? 0 : a.invMass;
  const invB = bLock ? 0 : b.invMass;
  const inv = invA + invB;
  if (inv <= 0) return;

  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv < 0) {
    const j = (-(1 + RESTITUTION) * rv) / inv;
    a.vx -= j * nx * invA;
    a.vy -= j * ny * invA;
    b.vx += j * nx * invB;
    b.vy += j * ny * invB;
    a.awake = 1;
    b.awake = 1;
  }

  const percent = aLock || bLock ? 1 : 0.86;
  const corr = (Math.max(pen - 0.5, 0) * percent) / inv;
  a.x -= nx * corr * invA;
  a.y -= ny * corr * invA;
  b.x += nx * corr * invB;
  b.y += ny * corr * invB;
}

function collide(bodies: Body[], hash: SpatialHash, dragged: number) {
  const { cell, cols, rows, head, next } = hash;
  const slots = cols * rows;
  head.fill(-1, 0, slots);
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    let cx = Math.floor(body.x / cell);
    let cy = Math.floor(body.y / cell);
    if (cx < 0) cx = 0;
    else if (cx >= cols) cx = cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= rows) cy = rows - 1;
    const slot = cy * cols + cx;
    next[i] = head[slot];
    head[slot] = i;
  }

  for (let i = 0; i < bodies.length; i += 1) {
    const a = bodies[i];
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(a.x / cell)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(a.y / cell)));
    for (let oy = -1; oy <= 1; oy += 1) {
      const ny = cy + oy;
      if (ny < 0 || ny >= rows) continue;
      for (let ox = -1; ox <= 1; ox += 1) {
        const nx = cx + ox;
        if (nx < 0 || nx >= cols) continue;
        let j = head[ny * cols + nx];
        while (j !== -1) {
          if (j > i) {
            const b = bodies[j];
            if (a.awake || b.awake || i === dragged || j === dragged) {
              resolve(a, b, i === dragged, j === dragged);
            }
          }
          j = next[j];
        }
      }
    }
  }
}

function edges(bodies: Body[], width: number, height: number, dragged: number) {
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    const left = body.w * 0.5;
    const right = width - left;
    const top = body.h * 0.5;
    const bottom = height - top;
    const held = i === dragged;
    if (body.x < left) {
      body.x = left;
      if (!held && body.vx < 0) {
        body.vx = -body.vx * RESTITUTION;
        body.awake = 1;
      }
    } else if (body.x > right) {
      body.x = right;
      if (!held && body.vx > 0) {
        body.vx = -body.vx * RESTITUTION;
        body.awake = 1;
      }
    }
    if (body.y < top) {
      body.y = top;
      if (!held && body.vy < 0) {
        body.vy = -body.vy * RESTITUTION;
        body.awake = 1;
      }
    } else if (body.y > bottom) {
      body.y = bottom;
      if (!held && body.vy > 0) {
        body.vy = -body.vy * RESTITUTION;
        body.awake = 1;
      }
    }
  }
}

function integrate(bodies: Body[], dt: number, dragged: number, allowSleep: boolean) {
  const damp = Math.exp(-DAMPING * dt);
  const sleep2 = SLEEP_SPEED * SLEEP_SPEED;
  for (let i = 0; i < bodies.length; i += 1) {
    if (i === dragged) continue;
    const body = bodies[i];
    if (!body.awake) continue;
    body.vx *= damp;
    body.vy *= damp;
    const speed2 = body.vx * body.vx + body.vy * body.vy;
    if (allowSleep && speed2 < sleep2) {
      body.vx = 0;
      body.vy = 0;
      body.awake = 0;
      continue;
    }
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }
}

export function stepBodies(
  bodies: Body[],
  hash: SpatialHash,
  width: number,
  height: number,
  dt: number,
  dragged: number,
  allowSleep: boolean,
) {
  if (dt <= 0 || bodies.length === 0) return;
  let maxSpeed = 0;
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    const speed = Math.hypot(body.vx, body.vy);
    if (speed > maxSpeed) maxSpeed = speed;
  }
  const sub = Math.min(6, Math.max(1, Math.ceil((maxSpeed * dt) / 40)));
  const subDt = dt / sub;
  prepareHash(hash, bodies.length, width, height);
  for (let step = 0; step < sub; step += 1) {
    integrate(bodies, subDt, dragged, allowSleep);
    collide(bodies, hash, dragged);
    edges(bodies, width, height, dragged);
  }
}
