import Fuse from "fuse.js";
import type { StudyRecord } from "@/src/lib/study";

export type SearchQuery = {
  q: string;
  category: string;
  subcategory: string;
  signal: string;
  input: string;
  action: string;
  body: string;
  country: string;
  decade: string;
};

export const EMPTY_QUERY: SearchQuery = {
  q: "",
  category: "",
  subcategory: "",
  signal: "",
  input: "",
  action: "",
  body: "",
  country: "",
  decade: "",
};

const FUSE_KEYS = [
  "name",
  "manufacturer",
  "platform",
  "significance",
  "description",
  "year",
  "categoryLabel",
  "subcategoryLabel",
  "decade",
] as const;

function haystack(record: StudyRecord) {
  return [
    record.name,
    record.manufacturer,
    record.platform,
    record.significance,
    record.description,
    record.year,
    record.categoryLabel,
    record.subcategoryLabel,
    record.decade,
    ...record.countries.map((tag) => tag.label),
  ]
    .join(" ")
    .toLocaleLowerCase("ru");
}

function hasSlug(tags: { slug: string }[], slug: string) {
  if (!slug) return true;
  return tags.some((tag) => tag.slug === slug);
}

export function searchRecords(
  records: StudyRecord[],
  query: SearchQuery,
  decadeLabel: string,
) {
  const text = query.q.trim();
  let pool = records;
  if (text.length >= 2) {
    const fuse = new Fuse(records, {
      keys: [...FUSE_KEYS],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    const fuzzy = new Set(fuse.search(text).map((result) => result.item.id));
    const needle = text.toLocaleLowerCase("ru");
    pool = records.filter((record) => fuzzy.has(record.id) || haystack(record).includes(needle));
  }
  return pool.filter((record) => {
    if (query.category && record.categorySlug !== query.category) return false;
    if (query.subcategory && record.subcategorySlug !== query.subcategory) return false;
    if (!hasSlug(record.signalTypes, query.signal)) return false;
    if (!hasSlug(record.inputMethods, query.input)) return false;
    if (!hasSlug(record.actionCorrespondences, query.action)) return false;
    if (!hasSlug(record.bodyParts, query.body)) return false;
    if (!hasSlug(record.countries, query.country)) return false;
    if (query.decade && record.decade !== decadeLabel) return false;
    return true;
  });
}

export function queryFromParams(params: URLSearchParams): SearchQuery {
  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    subcategory: params.get("subcategory") ?? "",
    signal: params.get("signal") ?? "",
    input: params.get("input") ?? "",
    action: params.get("action") ?? "",
    body: params.get("body") ?? "",
    country: params.get("country") ?? "",
    decade: params.get("decade") ?? "",
  };
}

export function paramsFromQuery(query: SearchQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  return params;
}

export function hasActiveQuery(query: SearchQuery) {
  if (query.q.trim().length >= 2) return true;
  return Object.entries(query).some(([key, value]) => key !== "q" && value.trim() !== "");
}
