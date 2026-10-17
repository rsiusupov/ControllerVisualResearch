import type { Controller, Tag } from "@/data/types";

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
};

export function toStudy(record: Controller): StudyRecord {
  return {
    id: record.id,
    slug: record.slug,
    categorySlug: record.categorySlug,
    categoryLabel: record.categoryLabel,
    subcategoryLabel: record.subcategory?.label ?? "",
    subcategorySlug: record.subcategory?.slug ?? "",
    name: record.name,
    manufacturer: record.manufacturer,
    year: record.year,
    yearNumber: record.yearNumber,
    yearEnd: record.yearEnd,
    decade: record.decade,
    countries: record.country ?? [],
    signalTypes: record.signalTypes ?? [],
    inputMethods: record.inputMethods ?? [],
    actionCorrespondences: record.actionCorrespondences ?? [],
    bodyParts: record.bodyParts ?? [],
    platform: record.platform,
    description: record.description,
    significance: record.significance,
    images: Array.isArray(record.images) ? record.images : [],
  };
}
