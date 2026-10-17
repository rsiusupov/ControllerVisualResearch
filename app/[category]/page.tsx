import { notFound } from "next/navigation";
import { Suspense } from "react";
import { categories, controllers } from "@/data/controllers";
import type { CategorySlug } from "@/data/types";
import { CategoryTimeline } from "@/src/components/category-timeline";
import { toStudy } from "@/src/lib/study";

export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  return { title: category ? `${category.label} — Игровые контроллеры` : "Игровые контроллеры" };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  const records = controllers
    .filter((record) => record.categorySlug === (slug as CategorySlug))
    .map(toStudy);

  return (
    <Suspense fallback={<p className="quiet">Загрузка хронологии…</p>}>
      <CategoryTimeline category={category} records={records} />
    </Suspense>
  );
}
