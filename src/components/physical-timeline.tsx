"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { withBasePath } from "@/src/lib/base-path";
import type { StudyRecord } from "@/src/lib/study";
import { createHash, stepBodies, type Body } from "@/src/lib/physics";
import {
  imageCardSize,
  layoutDated,
  layoutUndated,
  type OriginReserve,
  type SceneCard,
  type TimelineScene,
  type YearMark,
} from "@/src/lib/timeline-layout";
import { formatYear } from "@/src/lib/years";
import { BloomCopy } from "@/src/components/bloom-copy";
import { ControllerDetail } from "@/src/components/controller-detail";
import { Dialog } from "@/src/ui/dialog";
import { Panel } from "@/src/ui/panel";

const VELOCITY_CAP = 3200;
const CLICK_SLOP = 6;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 1.25;
/** Matches the photo `.image-pop` animation in globals.css. */
const APPEAR_MS = 800;
const APPEAR_EASE = [0.23, 1, 0.32, 1] as const;

function appearEase(amount: number, x1: number, y1: number, x2: number, y2: number) {
  if (amount <= 0) return 0;
  if (amount >= 1) return 1;
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sample = (u: number, a: number, b: number, c: number) => ((a * u + b) * u + c) * u;
  const slope = (u: number, a: number, b: number, c: number) => (3 * a * u + 2 * b) * u + c;
  let u = amount;
  for (let step = 0; step < 8; step += 1) {
    const x = sample(u, ax, bx, cx) - amount;
    const dx = slope(u, ax, bx, cx);
    if (Math.abs(x) < 1e-5) break;
    if (Math.abs(dx) < 1e-6) break;
    u = Math.min(1, Math.max(0, u - x / dx));
  }
  return sample(u, ay, by, cy);
}

type Runtime = {
  bodies: Body[];
  cards: SceneCard[];
  years: YearMark[];
  dragged: number;
  z: number;
  warmup: number;
  width: number;
  height: number;
  grabX: number;
  grabY: number;
  samples: { x: number; y: number; t: number }[];
  frame: number;
  cancel: (() => void) | null;
  downX: number;
  downY: number;
  travel: number;
};

function controllerId(card: SceneCard) {
  const marker = card.kind === "image" ? ":image:" : ":name";
  const index = card.id.lastIndexOf(marker);
  return index === -1 ? card.id : card.id.slice(0, index);
}

/** Origin on the photo edge that faces its name card, so scale grows out of the title. */
function imageAppearOrigin(card: SceneCard, cards: SceneCard[]) {
  const name = cards[card.nameIndex];
  if (!name || name.kind !== "name") return "center";
  const dx = name.x - card.x;
  const dy = name.y - card.y;
  const reach = Math.max(Math.abs(dx), Math.abs(dy));
  if (reach < 1) return "center";
  const ox = Math.min(100, Math.max(0, 50 + (dx / reach) * 50));
  const oy = Math.min(100, Math.max(0, 50 + (dy / reach) * 50));
  return `${Math.round(ox)}% ${Math.round(oy)}%`;
}

type TimelineOrigin = {
  slug: string;
  count: number;
  label: string;
  description: string;
};

function sceneKey(
  records: StudyRecord[],
  axisStart: number | null,
  axisEnd: number | null,
  origin: OriginReserve | null,
) {
  const ids = records.map((record) => record.id).sort();
  const box = origin ? `${Math.round(origin.width)}x${Math.round(origin.height)}` : "0";
  return `${axisStart ?? "x"}:${axisEnd ?? "x"}:${box}:${ids.join("|")}`;
}

function useDatedScene(
  records: StudyRecord[],
  axisStart: number | null,
  axisEnd: number | null,
  origin: OriginReserve | null,
) {
  const cache = useRef<{ key: string; scene: TimelineScene | null }>({ key: "", scene: null });
  const key = sceneKey(records, axisStart, axisEnd, origin);
  if (cache.current.key !== key) {
    cache.current = {
      key,
      scene: axisStart == null || axisEnd == null ? null : layoutDated(records, axisStart, axisEnd, origin),
    };
  }
  return cache.current.scene;
}

function useUndatedScene(records: StudyRecord[]) {
  const cache = useRef<{ key: string; scene: TimelineScene | null }>({ key: "", scene: null });
  const key = sceneKey(records, null, null, null);
  if (cache.current.key !== key) {
    cache.current = { key, scene: layoutUndated(records) };
  }
  return cache.current.scene;
}

function Playfield({
  scene,
  axis,
  onOpen,
  origin = null,
  empty = false,
  onOriginBox,
}: {
  scene: TimelineScene;
  axis: boolean;
  onOpen: (controllerId: string, opener: HTMLElement) => void;
  origin?: TimelineOrigin | null;
  empty?: boolean;
  onOriginBox?: (box: OriginReserve) => void;
}) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onOriginBoxRef = useRef(onOriginBox);
  onOriginBoxRef.current = onOriginBox;
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomWrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const zoomToRef = useRef<(next: number, clientX: number, clientY: number) => void>(() => {});
  const wiresRef = useRef<SVGPathElement>(null);
  const nodesRef = useRef<(HTMLElement | null)[]>([]);
  const simRef = useRef<Runtime | null>(null);
  const appearOriginRef = useRef(new Map<string, string>());
  const appearedRef = useRef(new Set<string>());
  const wireStartRef = useRef(new Map<string, number>());
  const paintRef = useRef<() => void>(() => {});
  const fittedRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const adoptRef = useRef<(index: number, naturalWidth: number, naturalHeight: number) => void>(() => {});
  const crowdedStart = scene.years.some((year) => Math.abs(year.x - scene.axisStartX) < 56);
  const axisX1 = scene.originW > 0 ? scene.originX + scene.originW : scene.axisStartX;
  const lastYear = scene.years[scene.years.length - 1];
  const showEnd =
    axis &&
    scene.axisEndYear != null &&
    (!lastYear || lastYear.year !== scene.axisEndYear || Math.abs(lastYear.x - scene.axisEndX) > 36);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    const wires = wiresRef.current;
    if (!field || !wires) return;

    const bodies: Body[] = scene.cards.map((card) => {
      const fitted = card.kind === "image" ? fittedRef.current.get(card.id) : undefined;
      const w = fitted?.w ?? card.w;
      const h = fitted?.h ?? card.h;
      return {
        x: card.x,
        y: card.y,
        w,
        h,
        vx: 0,
        vy: 0,
        invMass: 1 / (w * h),
        awake: 1,
      };
    });
    const hash = createHash(bodies.length, scene.width, scene.height);
    const runtime: Runtime = {
      bodies,
      cards: scene.cards,
      years: scene.years,
      dragged: -1,
      z: 4,
      warmup: 16,
      width: scene.width,
      height: scene.height,
      grabX: 0,
      grabY: 0,
      samples: [],
      frame: 0,
      cancel: null,
      downX: 0,
      downY: 0,
      travel: 0,
    };
    simRef.current = runtime;
    let wireFrame = 0;

    const wireReveal = (id: string, now: number) => {
      const start = wireStartRef.current.get(id);
      if (start == null) return { progress: 0, live: false };
      if (start < 0) return { progress: 1, live: false };
      const elapsed = (now - start) / APPEAR_MS;
      if (elapsed >= 1) {
        wireStartRef.current.set(id, -1);
        return { progress: 1, live: false };
      }
      return { progress: appearEase(Math.max(0, elapsed), ...APPEAR_EASE), live: true };
    };

    const paint = () => {
      if (simRef.current !== runtime) return;
      const nodes = nodesRef.current;
      const now = performance.now();
      let path = "";
      let growing = false;
      for (let index = 0; index < bodies.length; index += 1) {
        const body = bodies[index];
        const node = nodes[index];
        if (node) {
          node.style.width = `${body.w}px`;
          node.style.height = `${body.h}px`;
          node.style.transform = `translate3d(${body.x - body.w / 2}px, ${body.y - body.h / 2}px, 0)`;
        }
        const card = scene.cards[index];
        if (card.kind === "name") {
          const year = scene.years[card.yearIndex];
          if (!year) continue;
          path += `M${year.x} ${year.y}L${body.x} ${body.y}`;
          continue;
        }
        const name = bodies[card.nameIndex];
        if (!name) continue;
        const reveal = wireReveal(card.id, now);
        if (reveal.live) growing = true;
        if (reveal.progress <= 0) continue;
        const x = name.x + (body.x - name.x) * reveal.progress;
        const y = name.y + (body.y - name.y) * reveal.progress;
        path += `M${name.x} ${name.y}L${x} ${y}`;
      }
      wires.setAttribute("d", path);
      if (growing && !wireFrame) {
        wireFrame = window.requestAnimationFrame(() => {
          wireFrame = 0;
          paint();
        });
      }
    };
    paintRef.current = paint;

    const kick = () => {
      if (runtime.frame) return;
      let last = performance.now();
      const tick = () => {
        const now = performance.now();
        const dt = Math.min(0.034, Math.max(0, (now - last) / 1000));
        last = now;
        runtime.frame = 0;
        const moving = runtime.dragged >= 0 || runtime.warmup > 0 || bodies.some((body) => body.awake);
        if (!moving) return;
        stepBodies(bodies, hash, runtime.width, runtime.height, dt, runtime.dragged, runtime.warmup <= 0);
        if (runtime.warmup > 0) runtime.warmup -= 1;
        paint();
        runtime.frame = window.setTimeout(tick, 16);
      };
      runtime.cancel = () => {
        if (runtime.frame) window.clearTimeout(runtime.frame);
        runtime.frame = 0;
      };
      runtime.frame = window.setTimeout(tick, 16);
    };

    const pointOf = (event: PointerEvent) => {
      const rect = field.getBoundingClientRect();
      const scale = zoomRef.current || 1;
      return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
    };

    const onMove = (event: PointerEvent) => {
      if (runtime.dragged < 0) return;
      const travel = Math.hypot(event.clientX - runtime.downX, event.clientY - runtime.downY);
      if (travel > runtime.travel) runtime.travel = travel;
      const body = bodies[runtime.dragged];
      const point = pointOf(event);
      const halfW = body.w / 2;
      const halfH = body.h / 2;
      const x = Math.min(runtime.width - halfW, Math.max(halfW, point.x + runtime.grabX));
      const y = Math.min(runtime.height - halfH, Math.max(halfH, point.y + runtime.grabY));
      const now = performance.now();
      const previous = runtime.samples[runtime.samples.length - 1];
      if (previous && now > previous.t) {
        const dt = Math.max(0.008, (now - previous.t) / 1000);
        body.vx = (x - previous.x) / dt;
        body.vy = (y - previous.y) / dt;
      }
      runtime.samples.push({ x, y, t: now });
      while (runtime.samples.length > 4) runtime.samples.shift();
      body.x = x;
      body.y = y;
      body.awake = 1;
      paint();
      kick();
    };

    const onUp = (event: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const index = runtime.dragged;
      runtime.dragged = -1;
      const node = nodesRef.current[index];
      node?.classList.remove("is-dragging");
      if (index < 0) return;
      const body = bodies[index];
      const travel = Math.max(
        runtime.travel,
        Math.hypot(event.clientX - runtime.downX, event.clientY - runtime.downY),
      );
      if (travel <= CLICK_SLOP) {
        body.vx = 0;
        body.vy = 0;
        body.awake = 1;
        runtime.samples = [];
        const card = runtime.cards[index];
        if (node && card) onOpenRef.current(controllerId(card), node);
        kick();
        return;
      }
      const last = runtime.samples[runtime.samples.length - 1];
      if (!last || performance.now() - last.t > 160) {
        body.vx = 0;
        body.vy = 0;
      }
      const speed = Math.hypot(body.vx, body.vy);
      if (speed > VELOCITY_CAP) {
        body.vx = (body.vx / speed) * VELOCITY_CAP;
        body.vy = (body.vy / speed) * VELOCITY_CAP;
      }
      body.awake = 1;
      runtime.samples = [];
      kick();
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-origin]")) return;
      const slot = target.closest("[data-index]");
      if (!slot || !field.contains(slot)) return;
      const index = Number(slot.getAttribute("data-index"));
      const body = bodies[index];
      if (!body || Number.isNaN(index)) return;
      event.preventDefault();
      const point = pointOf(event);
      runtime.dragged = index;
      runtime.grabX = body.x - point.x;
      runtime.grabY = body.y - point.y;
      runtime.downX = event.clientX;
      runtime.downY = event.clientY;
      runtime.travel = 0;
      runtime.samples = [{ x: body.x, y: body.y, t: performance.now() }];
      body.vx = 0;
      body.vy = 0;
      body.awake = 1;
      runtime.z += 1;
      const node = nodesRef.current[index];
      if (node) {
        node.style.zIndex = String(runtime.z);
        node.classList.add("is-dragging");
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      kick();
    };

    const growField = () => {
      const pad = 72;
      let width = runtime.width;
      let height = runtime.height;
      for (const body of bodies) {
        width = Math.max(width, body.x + body.w / 2 + pad);
        height = Math.max(height, body.y + body.h / 2 + pad);
      }
      runtime.width = width;
      runtime.height = height;
      const scale = zoomRef.current || 1;
      field.style.width = `${width}px`;
      field.style.height = `${height}px`;
      field.style.transform = `scale(${scale})`;
      field.style.transformOrigin = "0 0";
      const wrap = zoomWrapRef.current;
      if (wrap) {
        wrap.style.width = `${width * scale}px`;
        wrap.style.height = `${height * scale}px`;
      }
    };

    const adoptImage = (index: number, naturalWidth: number, naturalHeight: number) => {
      if (!(naturalWidth > 0) || !(naturalHeight > 0)) return false;
      const card = runtime.cards[index];
      const body = bodies[index];
      if (!card || !body || card.kind !== "image") return false;
      const next = imageCardSize(naturalWidth, naturalHeight);
      fittedRef.current.set(card.id, next);
      if (body.w === next.w && body.h === next.h) return false;
      body.w = next.w;
      body.h = next.h;
      body.invMass = 1 / (next.w * next.h);
      const name = bodies[card.nameIndex];
      if (name) {
        const dx = body.x - name.x;
        const dy = body.y - name.y;
        const len = Math.hypot(dx, dy);
        let ux = len > 0 ? dx / len : 0;
        let uy = len > 0 ? dy / len : 0;
        if (len < 1) {
          const year = runtime.years[card.yearIndex];
          ux = 0;
          uy = year && body.y < year.y ? -1 : 1;
        }
        const need =
          ((name.w + body.w) / 2) * Math.abs(ux) + ((name.h + body.h) / 2) * Math.abs(uy) + 10;
        if (len < need) {
          body.x = name.x + ux * need;
          body.y = name.y + uy * need;
        }
      }
      body.awake = 1;
      holdNames();
      return true;
    };
    const holdNames = () => {
      const dragged = runtime.dragged;
      for (let index = 0; index < bodies.length; index += 1) {
        if (runtime.cards[index]?.kind !== "name" || index === dragged) continue;
        const body = bodies[index];
        body.invMass = 0;
        body.vx = 0;
        body.vy = 0;
        body.awake = 0;
      }
    };
    let fitFrame = 0;
    const flushFits = () => {
      holdNames();
      if (fitFrame) return;
      fitFrame = window.requestAnimationFrame(() => {
        fitFrame = 0;
        if (simRef.current !== runtime) return;
        const dragged = runtime.dragged;
        for (let index = 0; index < bodies.length; index += 1) {
          const body = bodies[index];
          if (runtime.cards[index]?.kind !== "name" || index === dragged) {
            body.awake = 1;
            continue;
          }
          body.invMass = 0;
          body.vx = 0;
          body.vy = 0;
          body.awake = 0;
        }
        growField();
        for (let step = 0; step < 14; step += 1) {
          stepBodies(bodies, hash, runtime.width, runtime.height, 1 / 60, dragged, false);
        }
        for (let index = 0; index < bodies.length; index += 1) {
          const body = bodies[index];
          if (runtime.cards[index]?.kind === "name") body.invMass = 1 / (body.w * body.h);
          if (index === dragged) continue;
          body.vx = 0;
          body.vy = 0;
          body.awake = 0;
        }
        runtime.warmup = 0;
        growField();
        paint();
      });
    };
    adoptRef.current = (index, naturalWidth, naturalHeight) => {
      if (simRef.current !== runtime) return;
      if (adoptImage(index, naturalWidth, naturalHeight)) flushFits();
    };

    const scanImages = () => {
      if (simRef.current !== runtime) return false;
      const nodes = nodesRef.current;
      let pending = false;
      let dirty = false;
      for (let index = 0; index < nodes.length; index += 1) {
        const img = nodes[index]?.querySelector("img");
        if (!(img instanceof HTMLImageElement) || img.dataset.broken != null) continue;
        if (!img.complete) {
          pending = true;
          continue;
        }
        if (adoptImage(index, img.naturalWidth, img.naturalHeight)) dirty = true;
      }
      if (dirty) flushFits();
      return pending;
    };

    const onMedia = (event: Event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !field.contains(img)) return;
      if (event.type === "error") {
        img.dataset.broken = "";
        return;
      }
      const slot = img.closest("[data-index]");
      if (!(slot instanceof HTMLElement)) return;
      const index = Number(slot.getAttribute("data-index"));
      if (Number.isNaN(index)) return;
      adoptRef.current(index, img.naturalWidth, img.naturalHeight);
    };

    let scanFrame = 0;
    let scans = 0;
    const scanAgain = () => {
      scanFrame = 0;
      if (simRef.current !== runtime) return;
      const pending = scanImages();
      scans += 1;
      if (pending && scans < 12) scanFrame = window.requestAnimationFrame(scanAgain);
    };

    field.addEventListener("pointerdown", onDown);
    field.addEventListener("load", onMedia, true);
    field.addEventListener("error", onMedia, true);
    scanImages();
    scanFrame = window.requestAnimationFrame(scanAgain);
    growField();
    paint();
    kick();
    if (axis) {
      const scroll = scrollRef.current;
      if (scroll) {
        const scale = zoomRef.current || 1;
        scroll.scrollTop = Math.max(0, scene.axisY * scale - scroll.clientHeight * 0.38);
      }
    }

    return () => {
      field.removeEventListener("pointerdown", onDown);
      field.removeEventListener("load", onMedia, true);
      field.removeEventListener("error", onMedia, true);
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      if (fitFrame) window.cancelAnimationFrame(fitFrame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      runtime.cancel?.();
      if (runtime.frame) cancelAnimationFrame(runtime.frame);
      if (wireFrame) window.cancelAnimationFrame(wireFrame);
      simRef.current = null;
      paintRef.current = () => {};
    };
  }, [axis, scene]);

  useLayoutEffect(() => {
    // Scale lives on `.image-pop`. Paint rewrites the article translate every frame.
    // Photos stay scaled down until their name card crosses the timeline scroller.
    // A transform sits between that scroller and the cards, so IntersectionObserver
    // never reports them; the scroller's box is checked directly instead.
    const scroll = scrollRef.current;
    const nodes = nodesRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pending = new Map<number, { id: string; pop: HTMLElement }[]>();

    const settle = (pop: HTMLElement) => {
      if (pop.dataset.appear === "run") return;
      pop.dataset.appear = "done";
    };

    for (let index = 0; index < scene.cards.length; index += 1) {
      const card = scene.cards[index];
      if (card?.kind !== "image") continue;
      const pop = nodes[index]?.querySelector(":scope > .image-pop");
      if (!(pop instanceof HTMLElement)) continue;
      if (reduce || appearedRef.current.has(card.id)) {
        appearedRef.current.add(card.id);
        if (!wireStartRef.current.has(card.id)) wireStartRef.current.set(card.id, 0);
        settle(pop);
        continue;
      }
      const list = pending.get(card.nameIndex) ?? [];
      list.push({ id: card.id, pop });
      pending.set(card.nameIndex, list);
    }

    if (reduce || pending.size === 0 || !scroll) {
      paintRef.current();
      return;
    }

    const start = (nameIndex: number) => {
      const photos = pending.get(nameIndex);
      if (!photos) return false;
      const now = performance.now();
      let began = false;
      for (const photo of photos) {
        if (appearedRef.current.has(photo.id) || photo.pop.dataset.appear === "run" || photo.pop.dataset.appear === "done") {
          continue;
        }
        appearedRef.current.add(photo.id);
        if (!wireStartRef.current.has(photo.id)) wireStartRef.current.set(photo.id, now);
        photo.pop.dataset.appear = "run";
        began = true;
      }
      return began;
    };

    const reveal = () => {
      if (pending.size === 0) return;
      const box = scroll.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;
      let began = false;
      for (const nameIndex of [...pending.keys()]) {
        const nameNode = nodes[nameIndex];
        if (!nameNode) continue;
        const rect = nameNode.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const seen =
          rect.bottom > box.top &&
          rect.top < box.bottom &&
          rect.right > box.left &&
          rect.left < box.right;
        if (!seen) continue;
        if (start(nameIndex)) began = true;
        pending.delete(nameIndex);
      }
      if (began) paintRef.current();
    };

    reveal();
    paintRef.current();
    scroll.addEventListener("scroll", reveal, { passive: true });
    const stack = scroll.closest(".timeline-stack");
    if (stack && stack !== scroll) stack.addEventListener("scroll", reveal, { passive: true });
    const resize = new ResizeObserver(reveal);
    resize.observe(scroll);
    let frames = 0;
    let raf = 0;
    const follow = () => {
      reveal();
      frames += 1;
      if (pending.size > 0 && frames < 48) raf = window.requestAnimationFrame(follow);
    };
    raf = window.requestAnimationFrame(follow);

    return () => {
      scroll.removeEventListener("scroll", reveal);
      if (stack && stack !== scroll) stack.removeEventListener("scroll", reveal);
      resize.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [scene]);

  useLayoutEffect(() => {
    const node = originRef.current;
    if (!node) return;
    const read = () => {
      const rect = node.getBoundingClientRect();
      const scale = zoomRef.current || 1;
      const width = rect.width / scale;
      const height = rect.height / scale;
      if (width < 8 || height < 8) return;
      onOriginBoxRef.current?.({
        width: Math.round(width),
        height: Math.round(height),
      });
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    let cancelFonts = false;
    document.fonts?.ready.then(() => {
      if (!cancelFonts) read();
    });
    return () => {
      cancelFonts = true;
      observer.disconnect();
    };
  }, [origin?.slug]);

  useLayoutEffect(() => {
    const runtime = simRef.current;
    const field = fieldRef.current;
    if (!runtime) return;
    if (field) {
      const scale = zoomRef.current || 1;
      field.style.width = `${runtime.width}px`;
      field.style.height = `${runtime.height}px`;
      field.style.transform = `scale(${scale})`;
      field.style.transformOrigin = "0 0";
      const wrap = zoomWrapRef.current;
      if (wrap) {
        wrap.style.width = `${runtime.width * scale}px`;
        wrap.style.height = `${runtime.height * scale}px`;
      }
    }
    const nodes = nodesRef.current;
    for (let index = 0; index < runtime.bodies.length; index += 1) {
      const body = runtime.bodies[index];
      const node = nodes[index];
      if (!node) continue;
      node.style.width = `${body.w}px`;
      node.style.height = `${body.h}px`;
      node.style.transform = `translate3d(${body.x - body.w / 2}px, ${body.y - body.h / 2}px, 0)`;
    }
  });

  zoomToRef.current = (next, clientX, clientY) => {
    const scroll = scrollRef.current;
    const field = fieldRef.current;
    const wrap = zoomWrapRef.current;
    if (!scroll || !field || !wrap) return;
    const prev = zoomRef.current || 1;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    if (Math.abs(clamped - prev) < 0.0005) return;
    const rect = scroll.getBoundingClientRect();
    const anchorX = clientX - rect.left;
    const anchorY = clientY - rect.top;
    const worldX = (scroll.scrollLeft + anchorX) / prev;
    const worldY = (scroll.scrollTop + anchorY) / prev;
    const runtime = simRef.current;
    const width = runtime?.width ?? field.offsetWidth;
    const height = runtime?.height ?? field.offsetHeight;
    zoomRef.current = clamped;
    wrap.style.width = `${width * clamped}px`;
    wrap.style.height = `${height * clamped}px`;
    field.style.transform = `scale(${clamped})`;
    field.style.transformOrigin = "0 0";
    scroll.scrollLeft = worldX * clamped - anchorX;
    scroll.scrollTop = worldY * clamped - anchorY;
    setZoom(clamped);
  };

  useEffect(() => {
    const frame = frameRef.current;
    const scroll = scrollRef.current;
    if (!frame || !scroll) return;
    const onWheel = (event: WheelEvent) => {
      let dx = event.deltaX;
      let dy = event.deltaY;
      if (event.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      } else if (event.deltaMode === 2) {
        dx *= scroll.clientWidth;
        dy *= scroll.clientHeight;
      }
      if (Math.abs(dy) < 0.01 || Math.abs(dx) > Math.abs(dy) * 1.2) return;
      event.preventDefault();
      const prev = zoomRef.current || 1;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * Math.exp(-dy * 0.0022)));
      zoomToRef.current(next, event.clientX, event.clientY);
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  const appearOrigin = (card: SceneCard) => {
    const known = appearOriginRef.current.get(card.id);
    if (known) return known;
    const next = imageAppearOrigin(card, scene.cards);
    appearOriginRef.current.set(card.id, next);
    return next;
  };

  const zoomBy = (factor: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const rect = scroll.getBoundingClientRect();
    zoomToRef.current(zoomRef.current * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  return (
    <div className="play-frame" ref={frameRef}>
    <div className="play-scroll" ref={scrollRef}>
      <div
        ref={zoomWrapRef}
        className="play-zoom"
        style={{ width: scene.width * zoom, height: scene.height * zoom }}
      >
      <div
        ref={fieldRef}
        className="playfield"
        style={{ width: scene.width, height: scene.height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
        data-axis-start={scene.axisStartYear ?? ""}
        data-axis-end={scene.axisEndYear ?? ""}
        data-decade={scene.decadeLabel}
      >
        <svg className="play-svg" aria-hidden="true">
          {axis ? (
            <line
              className="axis-stroke"
              x1={axisX1}
              y1={scene.axisY}
              x2={scene.axisEndX}
              y2={scene.axisY}
            />
          ) : null}
          {axis ? (
            <line
              className="axis-stroke"
              x1={scene.axisStartX}
              y1={scene.axisY - 7}
              x2={scene.axisStartX}
              y2={scene.axisY + 7}
            />
          ) : null}
          {scene.years.map((year) => (
            <circle key={year.year} className="year-dot" cx={year.x} cy={year.y} r="4.5" />
          ))}
          <path ref={wiresRef} className="wires" />
        </svg>
        {axis && scene.decadeLabel ? (
          <div className={crowdedStart ? "decade-flag is-stacked" : "decade-flag"} style={{ left: scene.axisStartX, top: scene.axisY }}>
            {scene.decadeLabel}
          </div>
        ) : null}
        {scene.years.map((year) => (
          <div
            key={year.year}
            className="year-mark"
            data-year={year.year}
            data-side={year.side}
            style={{ left: year.x, top: year.y }}
          >
            <span>{formatYear(year.year)}</span>
          </div>
        ))}
        {showEnd && scene.axisEndYear != null ? (
          <div className="year-mark axis-end" style={{ left: scene.axisEndX, top: scene.axisY }}>
            <span>{formatYear(scene.axisEndYear)}</span>
          </div>
        ) : null}
        {scene.cards.map((card, index) => (
          <article
            key={card.id}
            data-card={card.id}
            data-kind={card.kind}
            data-year={card.year ?? ""}
            data-controller={controllerId(card)}
            data-index={index}
            tabIndex={-1}
            className="phys-card"
            style={{
              width: card.w,
              height: card.h,
              transform: `translate3d(${card.x - card.w / 2}px, ${card.y - card.h / 2}px, 0)`,
            }}
            ref={(node) => {
              nodesRef.current[index] = node;
              if (!node) return;
              const fitted = card.kind === "image" ? fittedRef.current.get(card.id) : undefined;
              const body = simRef.current?.bodies[index];
              const w = body?.w ?? fitted?.w ?? card.w;
              const h = body?.h ?? fitted?.h ?? card.h;
              node.style.width = `${w}px`;
              node.style.height = `${h}px`;
              if (node.dataset.placed === card.id) return;
              node.dataset.placed = card.id;
              const x = body?.x ?? card.x;
              const y = body?.y ?? card.y;
              node.style.transform = `translate3d(${x - w / 2}px, ${y - h / 2}px, 0)`;
            }}
          >
            {card.kind === "name" ? (
              <Panel className="name-face">
                <span className="year">{card.yearLabel}</span>
                <BloomCopy parts={[card.name]} />
                {card.meta ? <p className="quiet">{card.meta}</p> : null}
              </Panel>
            ) : (
              <div className="image-pop" style={{ transformOrigin: appearOrigin(card) }}>
                <Panel className="image-face bg-transparent p-0 gap-0 shadow-none ring-0">
                  <img
                    src={withBasePath(card.src)}
                    alt={card.name}
                    draggable={false}
                    onLoad={(event) => {
                      const img = event.currentTarget;
                      adoptRef.current(index, img.naturalWidth, img.naturalHeight);
                    }}
                    onError={(event) => {
                      event.currentTarget.dataset.broken = "";
                    }}
                  />
                </Panel>
              </div>
            )}
          </article>
        ))}
        {origin && scene.originW > 0 ? (
          <header
            ref={originRef}
            className="branch-head origin-card"
            data-origin=""
            style={{
              left: scene.originX,
              top: scene.axisY,
              viewTransitionName: `category-${origin.slug}`,
            }}
          >
            <p className="kicker">{origin.count} контроллеров</p>
            <h1>{origin.label}</h1>
            <p className="lede">{origin.description}</p>
          </header>
        ) : null}
        {empty ? (
          <p className="timeline-empty is-in-field" style={{ left: scene.axisStartX + 20, top: scene.axisY + 24 }}>
            В этом диапазоне нет контроллеров.
          </p>
        ) : null}
      </div>
      </div>
      {axis ? <div className="play-end-space" aria-hidden="true" /> : null}
    </div>
    <div className="play-zoom-controls">
      <button
        type="button"
        className="play-zoom-btn"
        aria-label="Уменьшить"
        disabled={zoom <= ZOOM_MIN + 0.001}
        onClick={() => zoomBy(1 / ZOOM_STEP)}
      >
        <i className="iRemove" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="play-zoom-btn"
        aria-label="Увеличить"
        disabled={zoom >= ZOOM_MAX - 0.001}
        onClick={() => zoomBy(ZOOM_STEP)}
      >
        <i className="iAdd" aria-hidden="true" />
      </button>
    </div>
    </div>
  );
}

export function PhysicalTimeline({
  dated,
  undated,
  axisStart,
  axisEnd,
  origin = null,
  empty = false,
}: {
  dated: StudyRecord[];
  undated: StudyRecord[];
  axisStart: number | null;
  axisEnd: number | null;
  origin?: TimelineOrigin | null;
  empty?: boolean;
}) {
  const [originBox, setOriginBox] = useState<OriginReserve>({ width: 400, height: 148 });
  const onOriginBox = useCallback((box: OriginReserve) => {
    setOriginBox((prev) =>
      Math.abs(prev.width - box.width) <= 1 && Math.abs(prev.height - box.height) <= 1 ? prev : box,
    );
  }, []);
  const datedScene = useDatedScene(dated, axisStart, axisEnd, origin ? originBox : null);
  const undatedScene = useUndatedScene(undated);
  const titleId = useId();
  const [selection, setSelection] = useState<{ record: StudyRecord; opener: HTMLElement } | null>(null);
  const byId = useMemo(() => {
    const map = new Map<string, StudyRecord>();
    for (const record of dated) map.set(record.id, record);
    for (const record of undated) map.set(record.id, record);
    return map;
  }, [dated, undated]);
  const openRecord = useCallback(
    (id: string, opener: HTMLElement) => {
      const record = byId.get(id);
      if (!record) return;
      setSelection({ record, opener });
    },
    [byId],
  );
  const closeRecord = useCallback(() => setSelection(null), []);

  return (
    <>
      <div className="timeline-stack">
        {datedScene ? (
          <Playfield
            scene={datedScene}
            axis
            onOpen={openRecord}
            origin={origin}
            empty={empty}
            onOriginBox={origin ? onOriginBox : undefined}
          />
        ) : origin ? (
          <div className="play-scroll">
            <header
              className="branch-head origin-card is-static"
              data-origin=""
              style={{ viewTransitionName: `category-${origin.slug}` }}
            >
              <p className="kicker">{origin.count} контроллеров</p>
              <h1>{origin.label}</h1>
              <p className="lede">{origin.description}</p>
            </header>
            {empty ? <p className="timeline-empty">В этом диапазоне нет контроллеров.</p> : null}
          </div>
        ) : null}
        {undatedScene ? (
          <section className="undated" aria-label="Без даты">
            <div className="undated-copy">
              <h2 className="decade">Без даты</h2>
              <p className="quiet">Год не указан, поэтому эти контроллеры стоят вне числовой шкалы.</p>
            </div>
            <Playfield scene={undatedScene} axis={false} onOpen={openRecord} />
          </section>
        ) : null}
      </div>
      <Dialog
        open={selection != null}
        onClose={closeRecord}
        labelledBy={titleId}
        restoreFocus={selection?.opener ?? null}
      >
        {selection ? <ControllerDetail record={selection.record} titleId={titleId} /> : null}
      </Dialog>
    </>
  );
}
