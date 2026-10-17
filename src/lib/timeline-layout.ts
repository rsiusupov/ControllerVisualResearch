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

function fanSlots(sizes: { width: number; height: number }[]) {
  const rows: number[][] = [];
  let cursor = 0;
  let rowSize = 1;
  while (cursor < sizes.length) {
    const count = Math.min(rowSize, sizes.length - cursor);
    const row: number[] = [];
    for (let index = 0; index < count; index += 1) row.push(cursor + index);
    rows.push(row);
    cursor += count;
    rowSize += 1;
  }

  const slots = sizes.map(() => ({ x: 0, y: 0 }));
  let top = YEAR_CLEARANCE;
  for (const row of rows) {
    const rowH = Math.max(...row.map((index) => sizes[index].height));
    const rowW = row.reduce((sum, index) => sum + sizes[index].width, 0) + GAP * (row.length - 1);
    let left = -rowW / 2;
    for (const index of row) {
      const size = sizes[index];
      slots[index] = {
        x: left + size.width / 2,
        y: top + NAME_H / 2,
      };
      left += size.width + GAP;
    }
    top += rowH + GAP * 2;
  }
  return slots;
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

function bounds(cards: Draft[]) {
  let minX = 0;
  let maxX = 0;
  let maxY = 0;
  for (const card of cards) {
    minX = Math.min(minX, card.x - card.w / 2);
    maxX = Math.max(maxX, card.x + card.w / 2);
    maxY = Math.max(maxY, card.y + card.h / 2);
  }
  return { minX, maxX, maxY };
}

function emptyScene(axisStart: number | null, axisEnd: number | null, decadeLabel: string): TimelineScene {
  const span = axisStart == null || axisEnd == null ? 0 : Math.max(0, axisEnd - axisStart);
  const width = Math.max(320, PAD * 2 + span * pixelsPerYear(span));
  return {
    width,
    height: 168,
    axisY: AXIS_Y,
    axisStartX: PAD,
    axisEndX: width - PAD,
    axisStartYear: axisStart,
    axisEndYear: axisEnd,
    decadeLabel,
    years: [],
    cards: [],
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

export function layoutDated(records: StudyRecord[], axisStart: number, axisEnd: number): TimelineScene {
  const decadeLabel = formatDecade(axisStart);
  const groups = new Map<number, StudyRecord[]>();
  for (const record of records) {
    if (record.yearNumber == null) continue;
    const list = groups.get(record.yearNumber);
    if (list) list.push(record);
    else groups.set(record.yearNumber, [record]);
  }
  const yearNumbers = [...groups.keys()].sort((a, b) => a - b);
  if (!yearNumbers.length) return emptyScene(axisStart, axisEnd, decadeLabel);

  const span = Math.max(1, axisEnd - axisStart);
  const scale = pixelsPerYear(span);
  const origin = PAD;
  const placed: { year: number; x: number; cards: Draft[]; minX: number; maxX: number; maxY: number }[] = [];
  let previousRight = origin;

  for (const year of yearNumbers) {
    const members = (groups.get(year) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const sizes = members.map((record) => clusterSize(record.images.length));
    const slots = fanSlots(sizes);
    const drafts: Draft[] = [];
    members.forEach((record, index) => {
      const slot = slots[index];
      const nameId = `${record.id}:name`;
      drafts.push({
        id: nameId,
        kind: "name",
        year,
        yearIndex: placed.length,
        recordId: record.id,
        x: slot.x,
        y: slot.y,
        w: NAME_W,
        h: NAME_H,
        name: record.name,
        yearLabel: record.year || formatYear(year),
        meta: record.manufacturer,
        src: "",
      });
      const spots = imageLocals(record.images.length);
      record.images.forEach((src, imageIndex) => {
        const spot = spots[imageIndex];
        drafts.push({
          id: `${record.id}:image:${imageIndex}`,
          kind: "image",
          year,
          yearIndex: placed.length,
          recordId: record.id,
          x: slot.x + spot.x,
          y: slot.y + spot.y,
          w: IMG_W,
          h: IMG_H,
          name: record.name,
          yearLabel: "",
          meta: "",
          src,
        });
      });
    });
    relax(drafts);
    const box = bounds(drafts);
    const linear = origin + (year - axisStart) * scale;
    const x = Math.max(linear, previousRight + GAP - box.minX, origin - box.minX);
    previousRight = x + box.maxX;
    placed.push({ year, x, cards: drafts, ...box });
  }

  const last = placed[placed.length - 1];
  const tail = Math.max(0, axisEnd - last.year) * scale;
  const axisEndX = Math.max(origin + (axisEnd - axisStart) * scale, last.x + tail);
  const width = Math.max(axisEndX, last.x + last.maxX) + PAD;
  let height = 168;
  const cards: Draft[] = [];
  const years: YearMark[] = placed.map((group) => {
    for (const card of group.cards) {
      card.x += group.x;
      card.y += AXIS_Y;
      height = Math.max(height, card.y + card.h / 2 + PAD);
      cards.push(card);
    }
    return { year: group.year, x: group.x, y: AXIS_Y };
  });

  return {
    width,
    height,
    axisY: AXIS_Y,
    axisStartX: origin,
    axisEndX,
    axisStartYear: axisStart,
    axisEndYear: axisEnd,
    decadeLabel,
    years,
    cards: linkNames(cards),
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
  };
}
