import type { StudyRecord } from "@/src/lib/study";

export function formatYear(year: number) {
  if (year < 0) return `${Math.abs(year)} до н.э.`;
  return String(year);
}

/** First year of the decade that contains `year`. BCE decades floor toward −∞, so −495 starts at −500. */
export function decadeStart(year: number) {
  return Math.floor(year / 10) * 10;
}

export function formatDecade(year: number) {
  const start = decadeStart(year);
  if (start < 0) return `${Math.abs(start)}-е до н.э.`;
  return `${start}-е`;
}

export function clampYear(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function readBound(value: string | null, fallback: number, min: number, max: number) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clampYear(Math.round(parsed), min, max);
}

export function overlaps(record: StudyRecord, from: number, to: number) {
  if (record.yearNumber == null) return false;
  const start = record.yearNumber;
  const end = record.yearEnd ?? record.yearNumber;
  return end >= from && start <= to;
}

export function yearBins(records: StudyRecord[], min: number, max: number, count = 64) {
  const heights = Array.from({ length: count }, () => 0);
  const span = Math.max(1, max - min);
  for (const record of records) {
    if (record.yearNumber == null) continue;
    const ratio = (record.yearNumber - min) / span;
    const index = Math.min(count - 1, Math.max(0, Math.floor(ratio * count)));
    heights[index] += 1;
  }
  const peak = Math.max(1, ...heights);
  return heights.map((value) => value / peak);
}
