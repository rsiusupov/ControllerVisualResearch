"use client";

import { useLayoutEffect, useRef } from "react";
import type { StudyRecord } from "@/src/lib/study";
import { createHash, stepBodies, type Body } from "@/src/lib/physics";
import {
  imageCardSize,
  layoutDated,
  layoutUndated,
  type SceneCard,
  type TimelineScene,
  type YearMark,
} from "@/src/lib/timeline-layout";
import { formatYear } from "@/src/lib/years";
import { BloomCopy } from "@/src/components/bloom-copy";
import { Panel } from "@/src/ui/panel";

const VELOCITY_CAP = 3200;

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
};

function sceneKey(records: StudyRecord[], axisStart: number | null, axisEnd: number | null) {
  const ids = records.map((record) => record.id).sort();
  return `${axisStart ?? "x"}:${axisEnd ?? "x"}:${ids.join("|")}`;
}

function useDatedScene(records: StudyRecord[], axisStart: number | null, axisEnd: number | null) {
  const cache = useRef<{ key: string; scene: TimelineScene | null }>({ key: "", scene: null });
  const key = sceneKey(records, axisStart, axisEnd);
  if (cache.current.key !== key) {
    cache.current = {
      key,
      scene: axisStart == null || axisEnd == null ? null : layoutDated(records, axisStart, axisEnd),
    };
  }
  return cache.current.scene;
}

function useUndatedScene(records: StudyRecord[]) {
  const cache = useRef<{ key: string; scene: TimelineScene | null }>({ key: "", scene: null });
  const key = sceneKey(records, null, null);
  if (cache.current.key !== key) {
    cache.current = { key, scene: layoutUndated(records) };
  }
  return cache.current.scene;
}

function Playfield({ scene, axis }: { scene: TimelineScene; axis: boolean }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const wiresRef = useRef<SVGPathElement>(null);
  const nodesRef = useRef<(HTMLElement | null)[]>([]);
  const simRef = useRef<Runtime | null>(null);
  const fittedRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const adoptRef = useRef<(index: number, naturalWidth: number, naturalHeight: number) => void>(() => {});
  const crowdedStart = scene.years.some((year) => Math.abs(year.x - scene.axisStartX) < 56);
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
    };
    simRef.current = runtime;

    const paint = () => {
      const nodes = nodesRef.current;
      let path = "";
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
        } else {
          const name = bodies[card.nameIndex];
          if (!name) continue;
          path += `M${name.x} ${name.y}L${body.x} ${body.y}`;
        }
      }
      wires.setAttribute("d", path);
    };

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
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onMove = (event: PointerEvent) => {
      if (runtime.dragged < 0) return;
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

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const index = runtime.dragged;
      runtime.dragged = -1;
      const node = nodesRef.current[index];
      node?.classList.remove("is-dragging");
      if (index < 0) return;
      const body = bodies[index];
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
      const pad = 40;
      let width = runtime.width;
      let height = runtime.height;
      for (const body of bodies) {
        width = Math.max(width, body.x + body.w / 2 + pad);
        height = Math.max(height, body.y + body.h / 2 + pad);
      }
      runtime.width = width;
      runtime.height = height;
      field.style.width = `${width}px`;
      field.style.height = `${height}px`;
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
      body.awake = 1;
      return true;
    };
    const flushFits = () => {
      runtime.warmup = Math.max(runtime.warmup, 10);
      growField();
      paint();
      kick();
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

    return () => {
      field.removeEventListener("pointerdown", onDown);
      field.removeEventListener("load", onMedia, true);
      field.removeEventListener("error", onMedia, true);
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      runtime.cancel?.();
      if (runtime.frame) cancelAnimationFrame(runtime.frame);
      simRef.current = null;
    };
  }, [scene]);

  useLayoutEffect(() => {
    const runtime = simRef.current;
    const field = fieldRef.current;
    if (!runtime) return;
    if (field) {
      field.style.width = `${runtime.width}px`;
      field.style.height = `${runtime.height}px`;
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

  return (
    <div className="play-scroll">
      <div
        ref={fieldRef}
        className="playfield"
        style={{ width: scene.width, height: scene.height }}
        data-axis-start={scene.axisStartYear ?? ""}
        data-axis-end={scene.axisEndYear ?? ""}
        data-decade={scene.decadeLabel}
      >
        <svg className="play-svg" aria-hidden="true">
          {axis ? (
            <line
              className="axis-stroke"
              x1={scene.axisStartX}
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
          <div key={year.year} className="year-mark" data-year={year.year} style={{ left: year.x, top: year.y }}>
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
            data-index={index}
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
              <Panel className="image-face p-0 gap-0">
                <img
                  src={card.src}
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
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export function PhysicalTimeline({
  dated,
  undated,
  axisStart,
  axisEnd,
}: {
  dated: StudyRecord[];
  undated: StudyRecord[];
  axisStart: number | null;
  axisEnd: number | null;
}) {
  const datedScene = useDatedScene(dated, axisStart, axisEnd);
  const undatedScene = useUndatedScene(undated);

  return (
    <>
      {datedScene ? <Playfield scene={datedScene} axis /> : null}
      {undatedScene ? (
        <section className="undated" aria-label="Без даты">
          <div className="undated-copy">
            <h2 className="decade">Без даты</h2>
            <p className="quiet">Год не указан, поэтому эти контроллеры стоят вне числовой шкалы.</p>
          </div>
          <Playfield scene={undatedScene} axis={false} />
        </section>
      ) : null}
    </>
  );
}
