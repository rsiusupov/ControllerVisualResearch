import type { Controller, Tag } from "@/data/types";
import { withBasePath } from "@/src/lib/base-path";

export type StudyRecord = {
  id: string;
  slug: string;
  categorySlug: Controller["categorySlug"];
  categoryLabel: string;
  subcategoryLabel: string;
  subcategorySlug: string;
  name: string;
  manufacturer: string;
  year: string;
  yearNumber: number | null;
  yearEnd: number | null;
  decade: string;
  countries: Tag[];
  signalTypes: Tag[];
  inputMethods: Tag[];
  actionCorrespondences: Tag[];
  bodyParts: Tag[];
  platform: string;
  description: string;
  significance: string;
  images: string[];
  sourceUrls: string[];
  imageUrls: string[];
};

function text(value: string | null | undefined, fallback?: string | null) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof fallback === "string" && fallback.trim()) return fallback;
  return "";
}

function urls(primary: string[] | null | undefined, fallback?: string[] | null) {
  const clean = (list: string[] | null | undefined) =>
    (list ?? []).map((item) => item.trim()).filter(Boolean);
  const main = clean(primary);
  return main.length ? main : clean(fallback);
}

export function toStudy(record: Controller): StudyRecord {
  const legacy = record.legacy;
  return {
    id: record.id,
    slug: record.slug,
    categorySlug: record.categorySlug,
    categoryLabel: record.categoryLabel,
    subcategoryLabel: record.subcategory?.label ?? "",
    subcategorySlug: record.subcategory?.slug ?? "",
    name: text(record.name, legacy?.name),
    manufacturer: text(record.manufacturer, legacy?.designer || legacy?.manufacturer),
    year: text(record.year, legacy?.year != null ? String(legacy.year) : ""),
    yearNumber: record.yearNumber,
    yearEnd: record.yearEnd,
    decade: record.decade,
    countries: record.country ?? [],
    signalTypes: record.signalTypes ?? [],
    inputMethods: record.inputMethods ?? [],
    actionCorrespondences: record.actionCorrespondences ?? [],
    bodyParts: record.bodyParts ?? [],
    platform: text(record.platform, legacy?.platform),
    description: text(record.description, legacy?.form),
    significance: text(record.significance, legacy?.innovation),
    images: Array.isArray(record.images)
      ? record.images.map((src) => src.trim()).filter(Boolean).map(withBasePath)
      : [],
    sourceUrls: urls(record.sourceUrls, legacy?.sources),
    imageUrls: urls(record.imageUrls, legacy?.imageSources),
  };
}
