"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CategoryInfo } from "@/data/types";
import { transitionPush } from "@/src/lib/navigate";
import styles from "./constellation.module.css";

/** Matches the 34% orbit and 22% planet size in globals.css. */
const ORBIT = 0.34;
const PLANET = 0.11;
const SUN = 0.15;
const GAP = 8;

type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  grabbed: boolean;
};

type Drag = {
  index: number;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  startX: number;
  startY: number;
  prevX: number;
  prevY: number;
  lastT: number;
};

function orbit(index: number, size: number) {
  const radians = ((index * 60 - 90) * Math.PI) / 180;
  return {
    x: size / 2 + Math.cos(radians) * size * ORBIT,
    y: size / 2 + Math.sin(radians) * size * ORBIT,
  };
}

function step(bodies: Body[], size: number, dtMs: number) {
  const frame = Math.min(dtMs, 34) / 16.67;
  const sunR = size * SUN;
  let moving = false;

  for (const body of bodies) {
    if (body.grabbed) continue;
    body.vx *= Math.pow(0.52, frame);
    body.vy *= Math.pow(0.52, frame);
    if (Math.hypot(body.vx, body.vy) < 0.15) {
      body.vx = 0;
      body.vy = 0;
      continue;
    }
    body.x += body.vx * frame;
    body.y += body.vy * frame;
    moving = true;
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        if (separate(bodies[i], bodies[j])) moving = true;
      }
    }
    for (const body of bodies) {
      if (pushFromSun(body, size / 2, sunR)) moving = true;
      if (keepInside(body, size)) moving = true;
    }
  }

  return moving;
}

function separate(a: Body, b: Body) {
  if (a.grabbed && b.grabbed) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const min = a.r + b.r + GAP;
  if (dist >= min) return false;
  const overlap = min - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  const aCan = !a.grabbed;
  const bCan = !b.grabbed;
  if (aCan && bCan) {
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) {
      const bounce = rel * 0.22;
      a.vx += bounce * nx;
      a.vy += bounce * ny;
      b.vx -= bounce * nx;
      b.vy -= bounce * ny;
    }
    return true;
  }
  const mover = aCan ? a : b;
  const sign = aCan ? -1 : 1;
  mover.x += sign * nx * overlap;
  mover.y += sign * ny * overlap;
  const vn = mover.vx * nx + mover.vy * ny;
  if (vn * sign < 0) {
    mover.vx -= vn * nx * 1.15;
    mover.vy -= vn * ny * 1.15;
  }
  return true;
}

function pushFromSun(body: Body, center: number, sunR: number) {
  if (body.grabbed) return false;
  const dx = body.x - center;
  const dy = body.y - center;
  const dist = Math.hypot(dx, dy) || 0.001;
  const min = body.r + sunR + GAP;
  if (dist >= min) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  body.x = center + nx * min;
  body.y = center + ny * min;
  const vn = body.vx * nx + body.vy * ny;
  if (vn < 0) {
    body.vx -= vn * nx * 1.15;
    body.vy -= vn * ny * 1.15;
  }
  return true;
}

type Sprite = {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  angle: number;
  /** Per-image size variation on top of the noise field. */
  scale: number;
  draw: number;
  /** Extra magnification from the pointer, eased toward the falloff. */
  focus: number;
  bitmap: HTMLCanvasElement | null;
  ready: boolean;
};

type Obstacle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

const FOCUS_RADIUS = 100;
const CELL = 28;
const PEAK = 34;

function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const u = fade(xf);
  const v = fade(yf);
  const sample = (ix: number, iy: number) => {
    let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const mixed =
    sample(x0, y0) * (1 - u) * (1 - v) +
    sample(x0 + 1, y0) * u * (1 - v) +
    sample(x0, y0 + 1) * (1 - u) * v +
    sample(x0 + 1, y0 + 1) * u * v;
  return mixed * 2 - 1;
}

function noise3(x: number, y: number, z: number) {
  const layer = Math.floor(z);
  const blend = fade(z - layer);
  const slice = (step: number) => valueNoise(x + step * 19.7, y + step * 7.3);
  const from = slice(layer);
  return from + (slice(layer + 1) - from) * blend;
}

const DRIFT = 0.055;

/** Invisible field: exact zero across wide regions, smooth peaks elsewhere. */
function fieldBrightness(x: number, y: number, now: number, reduced: boolean) {
  const drift = reduced ? 0 : now * DRIFT;
  const time = reduced ? 0 : now * 0.00012;
  const n = (noise3((x + drift) / 210, (y + drift) / 210, time) + 1) / 2;
  if (n <= 0.56) return 0;
  const t = Math.min(1, (n - 0.56) / 0.22);
  return Math.pow(t, 0.55);
}

function bakePhoto(image: HTMLImageElement) {
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const blurred = document.createElement("canvas");
  blurred.width = size;
  blurred.height = size;
  const blur = blurred.getContext("2d");
  if (!blur) return canvas;
  blur.filter = "blur(8px)";
  blur.drawImage(image, 6, 6, size - 12, size - 12);

  context.drawImage(blurred, 0, 0);
  context.globalCompositeOperation = "destination-in";
  const rim = context.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.5);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(0.5, "rgba(0,0,0,0.9)");
  rim.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = rim;
  context.fillRect(0, 0, size, size);

  const sharp = document.createElement("canvas");
  sharp.width = size;
  sharp.height = size;
  const core = sharp.getContext("2d");
  if (!core) return canvas;
  core.drawImage(image, 8, 8, size - 16, size - 16);
  core.globalCompositeOperation = "destination-in";
  const center = core.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.4);
  center.addColorStop(0, "#000");
  center.addColorStop(0.72, "#000");
  center.addColorStop(1, "transparent");
  core.fillStyle = center;
  core.fillRect(0, 0, size, size);

  context.globalCompositeOperation = "source-over";
  context.drawImage(sharp, 0, 0);
  return canvas;
}

function createSprites(urls: string[], count: number, aspect: number, token: { cancelled: boolean }) {
  const random = mulberry32(0x51ed);
  const cols = Math.max(1, Math.round(Math.sqrt(count * Math.max(aspect, 0.35))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const sprites: Sprite[] = [];
  const shared = new Map<string, Sprite[]>();

  for (let index = 0; index < count; index += 1) {
    const src = urls[index % urls.length];
    const col = index % cols;
    const row = Math.floor(index / cols);
    const homeX = Math.min(0.985, Math.max(0.015, (col + 0.5) / cols + (random() - 0.5) * 0.2 / cols));
    const homeY = Math.min(0.985, Math.max(0.015, (row + 0.5) / rows + (random() - 0.5) * 0.2 / rows));
    const sprite: Sprite = {
      homeX,
      homeY,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      phase: index * 19.7 + random() * 8,
      angle: (random() - 0.5) * 0.2,
      scale: 0.82 + random() * 0.36,
      draw: 0,
      focus: 0,
      bitmap: null,
      ready: false,
    };
    sprites.push(sprite);
    const group = shared.get(src);
    if (group) group.push(sprite);
    else shared.set(src, [sprite]);
  }

  for (const [src, group] of shared) {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (token.cancelled) return;
      const bitmap = bakePhoto(image);
      for (const sprite of group) {
        sprite.bitmap = bitmap;
        sprite.ready = true;
      }
    };
    image.onerror = () => {
      for (const sprite of group) sprite.ready = true;
    };
    image.src = src;
  }

  return sprites;
}

function stepSprites(
  sprites: Sprite[],
  obstacles: Obstacle[],
  width: number,
  height: number,
  now: number,
  reduced: boolean,
  pointer: { x: number; y: number } | null,
) {
  const time = reduced ? 0 : now * 0.00004;
  let moving = !reduced;

  for (const sprite of sprites) {
    const brightness = fieldBrightness(sprite.x, sprite.y, now, reduced);
    let focusTarget = 0;
    if (pointer && brightness > 0) {
      const dist = Math.hypot(sprite.x - pointer.x, sprite.y - pointer.y);
      if (dist < FOCUS_RADIUS) {
        const falloff = 1 - dist / FOCUS_RADIUS;
        focusTarget = falloff * falloff * 2.6;
      }
    }
    sprite.focus += (focusTarget - sprite.focus) * (reduced ? 1 : 0.16);
    if (Math.abs(sprite.focus - focusTarget) < 0.01) sprite.focus = focusTarget;
    else moving = true;
    sprite.draw = brightness * PEAK * sprite.scale * (1 + sprite.focus);
    const radius = sprite.draw * 0.42;

    if (!reduced) {
      const nx = valueNoise(time * 1.6, sprite.phase);
      const ny = valueNoise(sprite.phase + 30, time * 1.6);
      const turn = valueNoise(sprite.phase * 0.2, time) * 0.18;
      sprite.vx += (sprite.homeX * width + nx * 6 - sprite.x) * 0.04;
      sprite.vy += (sprite.homeY * height + ny * 6 - sprite.y) * 0.04;
      sprite.angle += (turn - sprite.angle) * 0.04;
    }

    for (const obstacle of obstacles) {
      const dx = sprite.x - (obstacle.x + obstacle.vx * 7);
      const dy = sprite.y - (obstacle.y + obstacle.vy * 7);
      const dist = Math.hypot(dx, dy) || 0.001;
      const min = obstacle.r + radius + 8;
      if (dist >= min) continue;
      const push = ((min - dist) / min) * 2.4;
      sprite.vx += (dx / dist) * push;
      sprite.vy += (dy / dist) * push;
      moving = true;
    }

    sprite.vx *= 0.86;
    sprite.vy *= 0.86;
    if (reduced && Math.hypot(sprite.vx, sprite.vy) < 0.05) {
      sprite.vx = 0;
      sprite.vy = 0;
    } else if (sprite.vx !== 0 || sprite.vy !== 0) {
      moving = true;
    }
    sprite.x += sprite.vx;
    sprite.y += sprite.vy;

    if (sprite.draw <= 0) continue;
    const pad = sprite.draw * 0.72;
    if (sprite.x < pad) sprite.x = pad;
    else if (sprite.x > width - pad) sprite.x = width - pad;
    if (sprite.y < pad) sprite.y = pad;
    else if (sprite.y > height - pad) sprite.y = height - pad;
  }

  return moving;
}

function paintField(
  canvas: HTMLCanvasElement,
  sprites: Sprite[],
  obstacles: Obstacle[],
  width: number,
  height: number,
) {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const pixelsWide = Math.max(1, Math.round(width * dpr));
  const pixelsHigh = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
    canvas.width = pixelsWide;
    canvas.height = pixelsHigh;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;

  const order = sprites.filter((sprite) => sprite.bitmap && sprite.draw >= 0.75).sort((a, b) => a.draw - b.draw);
  for (const sprite of order) {
    if (!sprite.bitmap) continue;
    const span = sprite.draw;
    const radius = span * 0.42;
    let alpha = 0.92;
    for (const obstacle of obstacles) {
      const dist = Math.hypot(sprite.x - obstacle.x, sprite.y - obstacle.y);
      const edge = obstacle.r + radius * 0.45;
      if (dist < edge) alpha = Math.min(alpha, Math.max(0, dist / edge));
    }
    context.save();
    context.globalAlpha = alpha;
    context.translate(sprite.x, sprite.y);
    context.rotate(sprite.angle);
    context.drawImage(sprite.bitmap, -span / 2, -span / 2, span, span);
    context.restore();
  }
}

function keepInside(body: Body, size: number) {
  if (body.grabbed) return false;
  const min = body.r + 4;
  const max = size - body.r - 4;
  let hit = false;
  if (body.x < min) {
    body.x = min;
    body.vx = Math.abs(body.vx) * 0.18;
    hit = true;
  } else if (body.x > max) {
    body.x = max;
    body.vx = -Math.abs(body.vx) * 0.18;
    hit = true;
  }
  if (body.y < min) {
    body.y = min;
    body.vy = Math.abs(body.vy) * 0.18;
    hit = true;
  } else if (body.y > max) {
    body.y = max;
    body.vy = -Math.abs(body.vy) * 0.18;
    hit = true;
  }
  return hit;
}

export function Constellation({
  categories,
  images,
}: {
  categories: CategoryInfo[];
  images: string[];
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const blobRefs = useRef<(SVGCircleElement | null)[]>([]);
  const bodiesRef = useRef<Body[]>([]);
  const dragRef = useRef<Drag | null>(null);
  const sizeRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const seed = (size: number) => {
      const radius = size * PLANET;
      bodiesRef.current = categories.map((_, index) => {
        const point = orbit(index, size);
        return { x: point.x, y: point.y, vx: 0, vy: 0, r: radius, grabbed: false };
      });
    };

    const sync = (size: number) => {
      bodiesRef.current.forEach((body, index) => {
        const x = (body.x / size) * 100;
        const y = (body.y / size) * 100;
        const planet = planetRefs.current[index];
        if (planet) {
          planet.style.left = `${x}%`;
          planet.style.top = `${y}%`;
        }
        const blob = blobRefs.current[index];
        if (blob) {
          blob.setAttribute("cx", String(x));
          blob.setAttribute("cy", String(y));
        }
        const line = lineRefs.current[index];
        if (line) {
          line.setAttribute("x2", String(x));
          line.setAttribute("y2", String(y));
        }
      });
    };

    const measure = () => {
      const next = root.clientWidth;
      const prev = sizeRef.current;
      if (next <= 0) return;
      if (prev > 0 && bodiesRef.current.length === categories.length) {
        const scale = next / prev;
        for (const body of bodiesRef.current) {
          body.x *= scale;
          body.y *= scale;
          body.r = next * PLANET;
          body.vx *= scale;
          body.vy *= scale;
        }
      } else {
        seed(next);
      }
      sizeRef.current = next;
      sync(next);
    };

    measure();
    const token = { cancelled: false };
    const canvas = canvasRef.current;
    const home = root.parentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let fieldDirty = true;
    let fieldW = 0;
    let fieldH = 0;
    let sprites: Sprite[] = [];
    let pointer: { x: number; y: number } | null = null;
    const layoutField = () => {
      if (!canvas) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;
      if (!sprites.length && images.length) {
        const count = Math.min(1100, Math.max(1, Math.round((width / CELL) * (height / CELL))));
        sprites = createSprites(images, count, width / height, token);
      }
      if (fieldW > 0 && fieldH > 0) {
        const scaleX = width / fieldW;
        const scaleY = height / fieldH;
        for (const sprite of sprites) {
          sprite.x *= scaleX;
          sprite.y *= scaleY;
          sprite.vx *= scaleX;
          sprite.vy *= scaleY;
        }
      } else {
        for (const sprite of sprites) {
          sprite.x = sprite.homeX * width;
          sprite.y = sprite.homeY * height;
        }
      }
      fieldW = width;
      fieldH = height;
      fieldDirty = true;
    };
    const onHover = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!canvas || target?.closest(".planet, .sun, header, button, a")) {
        pointer = null;
        if (home) home.style.cursor = "";
        return;
      }
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      pointer = { x, y };
      let near = false;
      for (const sprite of sprites) {
        if (sprite.draw < 2) continue;
        if (Math.hypot(sprite.x - x, sprite.y - y) < FOCUS_RADIUS) {
          near = true;
          break;
        }
      }
      if (home) home.style.cursor = near ? "zoom-in" : "";
    };
    const onHoverLeave = () => {
      pointer = null;
      if (home) home.style.cursor = "";
    };
    layoutField();
    home?.addEventListener("pointermove", onHover);
    home?.addEventListener("pointerleave", onHoverLeave);
    const planets = [...root.querySelectorAll<HTMLDivElement>(".planet")];
    const cleanups = planets.map((planet, index) => {
      const onDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const node =
          event.target instanceof Element
            ? event.target
            : event.target instanceof Node
              ? event.target.parentElement
              : null;
        if (node?.closest(".planet-label")) return;
        const body = bodiesRef.current[index];
        const box = root.getBoundingClientRect();
        if (!body) return;
        body.grabbed = true;
        body.vx = 0;
        body.vy = 0;
        dragRef.current = {
          index,
          pointerId: event.pointerId,
          offsetX: event.clientX - box.left - body.x,
          offsetY: event.clientY - box.top - body.y,
          moved: false,
          startX: event.clientX,
          startY: event.clientY,
          prevX: body.x,
          prevY: body.y,
          lastT: performance.now(),
        };
        planet.setPointerCapture(event.pointerId);
      };
      const onMove = (event: PointerEvent) => {
        const drag = dragRef.current;
        const body = bodiesRef.current[index];
        if (!drag || !body || drag.index !== index || drag.pointerId !== event.pointerId) return;
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
          drag.moved = true;
        }
        if (!drag.moved) return;
        const box = root.getBoundingClientRect();
        body.x = event.clientX - box.left - drag.offsetX;
        body.y = event.clientY - box.top - drag.offsetY;
        const now = performance.now();
        const dt = Math.max(10, now - drag.lastT);
        body.vx = ((body.x - drag.prevX) / dt) * 16;
        body.vy = ((body.y - drag.prevY) / dt) * 16;
        drag.prevX = body.x;
        drag.prevY = body.y;
        drag.lastT = now;
        sync(root.clientWidth || sizeRef.current);
      };
      const onUp = (event: PointerEvent) => {
        const drag = dragRef.current;
        const body = bodiesRef.current[index];
        if (!drag || !body || drag.index !== index || drag.pointerId !== event.pointerId) return;
        body.grabbed = false;
        if (drag.moved) {
          const speed = Math.hypot(body.vx, body.vy);
          if (speed > 8) {
            body.vx = (body.vx / speed) * 8;
            body.vy = (body.vy / speed) * 8;
          }
        }
        dragRef.current = null;
        sync(root.clientWidth || sizeRef.current);
      };
      planet.dataset.physics = "1";
      planet.addEventListener("pointerdown", onDown);
      planet.addEventListener("pointermove", onMove);
      planet.addEventListener("pointerup", onUp);
      planet.addEventListener("pointercancel", onUp);
      return () => {
        planet.removeEventListener("pointerdown", onDown);
        planet.removeEventListener("pointermove", onMove);
        planet.removeEventListener("pointerup", onUp);
        planet.removeEventListener("pointercancel", onUp);
      };
    });
    let last = performance.now();
    let frame = 0;
    let running = true;
    const obstacles = (): Obstacle[] => {
      if (!canvas) return [];
      const field = canvas.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      const offsetX = box.left - field.left;
      const offsetY = box.top - field.top;
      const size = root.clientWidth || sizeRef.current;
      return [
        { x: size / 2 + offsetX, y: size / 2 + offsetY, vx: 0, vy: 0, r: size * SUN },
        ...bodiesRef.current.map((body) => ({
          x: body.x + offsetX,
          y: body.y + offsetY,
          vx: body.vx,
          vy: body.vy,
          r: body.r,
        })),
      ];
    };
    const loop = (now: number) => {
      frame = 0;
      if (!running || document.hidden) return;
      const size = root.clientWidth || sizeRef.current;
      const moving = step(bodiesRef.current, size, now - last);
      last = now;
      if (moving || dragRef.current) sync(size);
      const blocks = obstacles();
      const drifting = stepSprites(sprites, blocks, fieldW, fieldH, now, reducedMotion.matches, pointer);
      if (canvas && fieldW > 0 && fieldH > 0 && (!reducedMotion.matches || drifting || moving || dragRef.current || fieldDirty)) {
        paintField(canvas, sprites, blocks, fieldW, fieldH);
        fieldDirty = sprites.some((sprite) => !sprite.ready);
      }
      frame = requestAnimationFrame(loop);
    };
    const onVisibility = () => {
      if (document.hidden || !running) return;
      last = performance.now();
      if (!frame) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new ResizeObserver(() => {
      measure();
      layoutField();
    });
    observer.observe(root);
    if (home) observer.observe(home);
    return () => {
      running = false;
      token.cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      home?.removeEventListener("pointermove", onHover);
      home?.removeEventListener("pointerleave", onHoverLeave);
      if (home) home.style.cursor = "";
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      for (const sprite of sprites) sprite.bitmap = null;
    };
  }, [categories, images]);

  return (
    <>
      <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />
      <div className={`constellation ${styles.root}`} ref={rootRef}>
      <svg
        className={styles.spokes}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        overflow="visible"
        aria-hidden="true"
      >
        <defs>
          <filter
            id="constellation-metaball"
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            x="-30"
            y="-30"
            width="160"
            height="160"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.55" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -13"
              result="threshold"
            />
            <feFlood floodColor="#ffffff" result="paper" />
            <feComposite in="paper" in2="threshold" operator="in" result="goo" />
          </filter>
        </defs>
        <g filter="url(#constellation-metaball)" className={styles.goo}>
          <circle className={styles.blob} cx="50" cy="50" r={SUN * 100} />
          {categories.map((category, index) => {
            const point = orbit(index, 100);
            return (
              <line
                key={category.slug}
                ref={(node) => {
                  lineRefs.current[index] = node;
                }}
                className={styles.neck}
                x1={50}
                y1={50}
                x2={point.x}
                y2={point.y}
                strokeWidth={8}
                strokeLinecap="round"
              />
            );
          })}
          {categories.map((category, index) => {
            const point = orbit(index, 100);
            return (
              <circle
                key={category.slug}
                ref={(node) => {
                  blobRefs.current[index] = node;
                }}
                className={styles.blob}
                cx={point.x}
                cy={point.y}
                r={PLANET * 100}
              />
            );
          })}
        </g>
      </svg>
      <div className="sun" style={{ viewTransitionName: "site-title" }}>
        <h1>Игровые контроллеры</h1>
      </div>
      {categories.map((category, index) => {
        const point = orbit(index, 100);
        const href = `/${category.slug}/`;
        return (
          <div
            key={category.slug}
            ref={(node) => {
              planetRefs.current[index] = node;
            }}
            className="planet"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              viewTransitionName: `category-${category.slug}`,
            }}
          >
            <a
              className="planet-label"
              href={href}
              draggable={false}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                transitionPush(router, href);
              }}
            >
              <strong>{category.label}</strong>
            </a>
          </div>
        );
      })}
      </div>
    </>
  );
}
