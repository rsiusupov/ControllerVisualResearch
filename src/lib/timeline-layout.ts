import type { StudyRecord } from "./study";
import { formatDecade, formatYear } from "./years";

export const NAME_W = 180;
export const NAME_H = 92;
export const IMG_W = 108;
export const IMG_H = 80;
export const IMG_LONG = 160;
export const IMG_MIN = 64;

/** Fit a photo to the card: keep its ratio, cap the long side, and lift tiny files to a grabbable size. */
export function imageCardSize(naturalWidth: number, naturalHeight: number) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return { w: IMG_W, h: IMG_H };
  const long = Math.max(naturalWidth, naturalHeight);
  let scale = 1;
  if (long > IMG_LONG) scale = IMG_LONG / long;
  else if (long < IMG_MIN) scale = IMG_MIN / long;
  return {
    w: Math.max(1, Math.round(naturalWidth * scale)),
    h: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

const GAP = 14;
const AXIS_Y = 84;
const PAD = 40;
const YEAR_CLEARANCE = 46;
const ORIGIN_LINK = 72;
const AXIS_CLEAR = 28;

export type SceneCard = {
  id: string;
  kind: "name" | "image";
  year: number | null;
  yearIndex: number;
  nameIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  yearLabel: string;
  meta: string;
  src: string;
};

export type YearMark = {
  year: number;
  x: number;
  y: number;
  side: "above" | "below";
};

export type OriginReserve = {
  width: number;
  height: number;
};

export type TimelineScene = {
  width: number;
  height: number;
  axisY: number;
  axisStartX: number;
  axisEndX: number;
  axisStartYear: number | null;
  axisEndYear: number | null;
  decadeLabel: string;
  years: YearMark[];
  cards: SceneCard[];
  originX: number;
  originW: number;
  originH: number;
};

type Draft = {
  id: string;
  kind: "name" | "image";
  year: number | null;
  yearIndex: number;
  recordId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  yearLabel: string;
  meta: string;
  src: string;
};

function pixelsPerYear(span: number) {
  if (span <= 100) return 16;
  if (span <= 250) return 8;
  if (span <= 800) return 5;
  return 3.5;
}

function imageLocals(count: number) {
  const cols = Math.min(3, count);
  const spots: { x: number; y: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const rowCount = Math.min(cols, count - row * cols);
    const rowW = rowCount * IMG_W + (rowCount - 1) * GAP;
    spots.push({
      x: -rowW / 2 + col * (IMG_W + GAP) + IMG_W / 2,
      y: NAME_H / 2 + GAP + IMG_H / 2 + row * (IMG_H + GAP),
    });
  }
  return spots;
}

function clusterSize(imageCount: number) {
  const cols = Math.min(3, imageCount);
  const rows = imageCount ? Math.ceil(imageCount / cols) : 0;
  const gridW = imageCount ? cols * IMG_W + (cols - 1) * GAP : 0;
  const width = Math.max(NAME_W, gridW);
  const height = NAME_H + (rows ? GAP + rows * IMG_H + (rows - 1) * GAP : 0);
  return { width, height };
}

const FAN = Math.PI / 4;
const STEM = 56;
const AXIS_GAP = 48;
const SCENE_SLACK = 100;

/** One controller leaves at 90°. Several fan from 45° left of the perpendicular to 45° right. */
function fanAngles(count: number) {
  if (count <= 1) return [0];
  const angles: number[] = [];
  for (let index = 0; index < count; index += 1) {
    angles.push(-FAN + (FAN * 2 * index) / (count - 1));
  }
  return angles;
}

function outwardSpots(sizes: { w: number; h: number }[]) {
  const cols = Math.min(3, sizes.length);
  const spots: { x: number; y: number }[] = [];
  let rowStart = NAME_H / 2 + GAP;
  for (let start = 0; start < sizes.length; start += cols) {
    const row = sizes.slice(start, start + cols);
    const rowW = row.reduce((sum, size) => sum + size.w, 0) + GAP * (row.length - 1);
    const rowH = Math.max(...row.map((size) => size.h));
    let left = -rowW / 2;
    for (const size of row) {
      spots.push({ x: left + size.w / 2, y: rowStart + size.h / 2 });
      left += size.w + GAP;
    }
    rowStart += rowH + GAP;
  }
  return spots;
}

function radiusFloor(count: number) {
  let radius = STEM + NAME_H / 2;
  for (const angle of fanAngles(count)) {
    const sine = Math.abs(Math.sin(angle));
    const cosine = Math.max(0.2, Math.abs(Math.cos(angle)));
    const reach = (NAME_W / 2) * sine + (NAME_H / 2) * cosine;
    radius = Math.max(radius, reach + STEM, (AXIS_GAP + NAME_H / 2) / cosine);
  }
  return radius;
}

function cardsOverlap(a: Draft, b: Draft, gap: number) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap
  );
}

function hasOverlap(cards: Draft[], gap: number) {
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      if (cardsOverlap(cards[i], cards[j], gap)) return true;
    }
  }
  return false;
}

function buildYear(
  members: StudyRecord[],
  side: "above" | "below",
  yearIndex: number,
  radius: number,
) {
  const outward = side === "below" ? 1 : -1;
  const angles = fanAngles(members.length);
  const drafts: Draft[] = [];
  members.forEach((record, index) => {
    const angle = angles[index] ?? 0;
    const x = radius * Math.sin(angle);
    const y = outward * radius * Math.cos(angle);
    drafts.push({
      id: `${record.id}:name`,
      kind: "name",
      year: record.yearNumber,
      yearIndex,
      recordId: record.id,
      x,
      y,
      w: NAME_W,
      h: NAME_H,
      name: record.name,
      yearLabel: record.year || (record.yearNumber == null ? "" : formatYear(record.yearNumber)),
      meta: record.manufacturer,
      src: "",
    });
    const sizes = record.images.map(() => ({ w: IMG_W, h: IMG_H }));
    const spots = outwardSpots(sizes);
    record.images.forEach((src, imageIndex) => {
      const spot = spots[imageIndex] ?? { x: 0, y: NAME_H / 2 + GAP + IMG_H / 2 };
      const size = sizes[imageIndex] ?? { w: IMG_W, h: IMG_H };
      drafts.push({
        id: `${record.id}:image:${imageIndex}`,
        kind: "image",
        year: record.yearNumber,
        yearIndex,
        recordId: record.id,
        x: x + spot.x,
        y: y + outward * spot.y,
        w: size.w,
        h: size.h,
        name: record.name,
        yearLabel: "",
        meta: "",
        src,
      });
    });
  });
  return drafts;
}

function placeYear(members: StudyRecord[], side: "above" | "below", yearIndex: number) {
  const gap = 10;
  let low = radiusFloor(members.length);
  let high = low;
  while (hasOverlap(buildYear(members, side, yearIndex, high), gap) && high < 6400) {
    high = Math.max(high + 48, high * 1.45);
  }
  if (!hasOverlap(buildYear(members, side, yearIndex, high), gap)) {
    for (let step = 0; step < 16; step += 1) {
      const mid = (low + high) / 2;
      if (hasOverlap(buildYear(members, side, yearIndex, mid), gap)) low = mid;
      else high = mid;
    }
  }
  return buildYear(members, side, yearIndex, high);
}

function separate(cards: Draft[]) {
  for (let pass = 0; pass < 28; pass += 1) {
    let moved = false;
    for (let i = 0; i < cards.length; i += 1) {
      const a = cards[i];
      for (let j = i + 1; j < cards.length; j += 1) {
        const b = cards[j];
        const dx = b.x - a.x;
        const px = (a.w + b.w) * 0.5 + 8 - Math.abs(dx);
        if (px <= 0) continue;
        const dy = b.y - a.y;
        const py = (a.h + b.h) * 0.5 + 8 - Math.abs(dy);
        if (py <= 0) continue;
        if (px < py) {
          const push = px / 2;
          const sign = dx < 0 ? -1 : 1;
          a.x -= sign * push;
          b.x += sign * push;
        } else {
          const push = py / 2;
          const sign = dy <= 0 ? -1 : 1;
          a.y -= sign * push;
          b.y += sign * push;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function keepImagesBeyond(cards: Draft[]) {
  const names = new Map<string, Draft>();
  for (const card of cards) {
    if (card.kind === "name") names.set(card.recordId, card);
  }
  for (const card of cards) {
    if (card.kind !== "image") continue;
    const name = names.get(card.recordId);
    if (!name) continue;
    const minY = name.y + (name.h + card.h) / 2 + 8;
    if (card.y < minY) card.y = minY;
  }
}

function relax(cards: Draft[]) {
  separate(cards);
  keepImagesBeyond(cards);
  separate(cards);
  for (const card of cards) {
    const minY = card.h / 2 + YEAR_CLEARANCE;
    if (card.y < minY) card.y = minY;
  }
  keepImagesBeyond(cards);
}

function extent(cards: Draft[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const card of cards) {
    minX = Math.min(minX, card.x - card.w / 2);
    maxX = Math.max(maxX, card.x + card.w / 2);
    minY = Math.min(minY, card.y - card.h / 2);
    maxY = Math.max(maxY, card.y + card.h / 2);
  }
  if (!cards.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return { minX, maxX, minY, maxY };
}

function datedFrame(origin: OriginReserve | null) {
  if (!origin || origin.width <= 0 || origin.height <= 0) {
    return { axisY: AXIS_Y, axisStartX: PAD, originX: 0, originW: 0, originH: 0 };
  }
  const originH = origin.height;
  const originW = origin.width;
  const axisY = Math.round(AXIS_CLEAR + originH / 2);
  const originX = PAD;
  return {
    axisY,
    axisStartX: originX + originW + ORIGIN_LINK,
    originX,
    originW,
    originH,
  };
}

function emptyScene(
  axisStart: number | null,
  axisEnd: number | null,
  decadeLabel: string,
  origin: OriginReserve | null,
): TimelineScene {
  const frame = datedFrame(origin);
  const span = axisStart == null || axisEnd == null ? 0 : Math.max(0, axisEnd - axisStart);
  const width = Math.max(320, frame.axisStartX + span * pixelsPerYear(span) + PAD);
  return {
    width,
    height: Math.max(168, frame.axisY + frame.originH / 2 + PAD),
    axisY: frame.axisY,
    axisStartX: frame.axisStartX,
    axisEndX: width - PAD,
    axisStartYear: axisStart,
    axisEndYear: axisEnd,
    decadeLabel,
    years: [],
    cards: [],
    originX: frame.originX,
    originW: frame.originW,
    originH: frame.originH,
  };
}

function linkNames(cards: Draft[]): SceneCard[] {
  const nameIndex = new Map<string, number>();
  cards.forEach((card, index) => {
    if (card.kind === "name") nameIndex.set(card.recordId, index);
  });
  return cards.map((card) => {
    const owner = nameIndex.get(card.recordId);
    return {
      id: card.id,
      kind: card.kind,
      year: card.year,
      yearIndex: card.yearIndex,
      nameIndex: owner ?? 0,
      x: card.x,
      y: card.y,
      w: card.w,
      h: card.h,
      name: card.name,
      yearLabel: card.yearLabel,
      meta: card.meta,
      src: card.src,
    };
  });
}

export function layoutDated(
  records: StudyRecord[],
  axisStart: number,
  axisEnd: number,
  originReserve: OriginReserve | null = null,
): TimelineScene {
  const decadeLabel = formatDecade(axisStart);
  const groups = new Map<number, StudyRecord[]>();
  for (const record of records) {
    if (record.yearNumber == null) continue;
    const list = groups.get(record.yearNumber);
    if (list) list.push(record);
    else groups.set(record.yearNumber, [record]);
  }
  const yearNumbers = [...groups.keys()].sort((a, b) => a - b);
  if (!yearNumbers.length) return emptyScene(axisStart, axisEnd, decadeLabel, originReserve);

  const span = Math.max(1, axisEnd - axisStart);
  const scale = pixelsPerYear(span);
  const frame = datedFrame(originReserve);
  const axisOrigin = frame.axisStartX;
  const placed: {
    year: number;
    side: "above" | "below";
    x: number;
    cards: Draft[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }[] = [];

  for (const year of yearNumbers) {
    const members = (groups.get(year) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const side: "above" | "below" = placed.length % 2 === 0 ? "below" : "above";
    const drafts = placeYear(members, side, placed.length);
    const box = extent(drafts);
    let x = axisOrigin + (year - axisStart) * scale;
    x = Math.max(x, axisOrigin + GAP - box.minX);
    for (const prev of placed) {
      const vertical = box.minY < prev.maxY + GAP && prev.minY < box.maxY + GAP;
      if (!vertical) continue;
      x = Math.max(x, prev.x + prev.maxX + GAP - box.minX);
    }
    const previous = placed[placed.length - 1];
    if (previous) x = Math.max(x, previous.x + 32);
    placed.push({ year, side, x, cards: drafts, ...box });
  }

  const last = placed[placed.length - 1];
  const tail = Math.max(0, axisEnd - last.year) * scale;
  let axisEndX = Math.max(axisOrigin + (axisEnd - axisStart) * scale, last.x + tail);
  let top = frame.originH > 0 ? -frame.originH / 2 : 0;
  let bottom = frame.originH > 0 ? frame.originH / 2 : 0;
  let left = frame.originW > 0 ? frame.originX : axisOrigin;
  let right = axisEndX;
  for (const group of placed) {
    top = Math.min(top, group.minY);
    bottom = Math.max(bottom, group.maxY);
    left = Math.min(left, group.x + group.minX);
    right = Math.max(right, group.x + group.maxX);
  }
  const shift = Math.max(0, (frame.originW > 0 ? frame.originX : PAD) - left);
  const axisY = Math.max(frame.axisY, SCENE_SLACK - top);
  const width = Math.max(320, right + shift + PAD);
  const height = Math.max(168, axisY + bottom + SCENE_SLACK);
  axisEndX += shift;
  const cards: Draft[] = [];
  const years: YearMark[] = placed.map((group) => {
    group.x += shift;
    for (const card of group.cards) {
      card.x += group.x;
      card.y += axisY;
      cards.push(card);
    }
    return { year: group.year, x: group.x, y: axisY, side: group.side };
  });

  return {
    width,
    height,
    axisY,
    axisStartX: axisOrigin + shift,
    axisEndX,
    axisStartYear: axisStart,
    axisEndYear: axisEnd,
    decadeLabel,
    years,
    cards: linkNames(cards),
    originX: frame.originX + shift,
    originW: frame.originW,
    originH: frame.originH,
  };
}

export function layoutUndated(records: StudyRecord[]): TimelineScene | null {
  const members = records
    .filter((record) => record.yearNumber == null)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  if (!members.length) return null;

  const sizes = members.map((record) => clusterSize(record.images.length));
  const columns = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(members.length))));
  const drafts: Draft[] = [];
  let cursorX = PAD;
  let cursorY = PAD;
  let rowH = 0;
  let column = 0;
  let width = 320;

  members.forEach((record, index) => {
    const size = sizes[index];
    if (column >= columns) {
      column = 0;
      cursorX = PAD;
      cursorY += rowH + GAP * 2;
      rowH = 0;
    }
    const originX = cursorX + size.width / 2;
    const originY = cursorY + NAME_H / 2;
    drafts.push({
      id: `${record.id}:name`,
      kind: "name",
      year: null,
      yearIndex: -1,
      recordId: record.id,
      x: originX,
      y: originY,
      w: NAME_W,
      h: NAME_H,
      name: record.name,
      yearLabel: record.year || "без даты",
      meta: record.manufacturer,
      src: "",
    });
    const spots = imageLocals(record.images.length);
    record.images.forEach((src, imageIndex) => {
      const spot = spots[imageIndex];
      drafts.push({
        id: `${record.id}:image:${imageIndex}`,
        kind: "image",
        year: null,
        yearIndex: -1,
        recordId: record.id,
        x: originX + spot.x,
        y: originY + spot.y,
        w: IMG_W,
        h: IMG_H,
        name: record.name,
        yearLabel: "",
        meta: "",
        src,
      });
    });
    cursorX += size.width + GAP * 2;
    rowH = Math.max(rowH, size.height);
    column += 1;
    width = Math.max(width, cursorX + PAD);
  });

  relax(drafts);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = 0;
  let maxY = 0;
  for (const card of drafts) {
    minX = Math.min(minX, card.x - card.w / 2);
    minY = Math.min(minY, card.y - card.h / 2);
    maxX = Math.max(maxX, card.x + card.w / 2);
    maxY = Math.max(maxY, card.y + card.h / 2);
  }
  const shiftX = PAD - minX;
  const shiftY = PAD - minY;
  for (const card of drafts) {
    card.x += shiftX;
    card.y += shiftY;
  }

  return {
    width: Math.max(320, maxX + shiftX + PAD),
    height: Math.max(160, maxY + shiftY + PAD),
    axisY: 0,
    axisStartX: 0,
    axisEndX: 0,
    axisStartYear: null,
    axisEndYear: null,
    decadeLabel: "",
    years: [],
    cards: linkNames(drafts),
    originX: 0,
    originW: 0,
    originH: 0,
  };
}
