"use client";

import { useSearchParams } from "next/navigation";
import type { CategoryInfo } from "@/data/types";
import { PhysicalTimeline } from "@/src/components/physical-timeline";
import { YearRange } from "@/src/components/year-range";
import type { StudyRecord } from "@/src/lib/study";
import { decadeStart, overlaps, readBound } from "@/src/lib/years";

export function CategoryTimeline({
  category,
  records,
}: {
  category: CategoryInfo;
  records: StudyRecord[];
}) {
  const searchParams = useSearchParams();
  const min = category.yearExtent.min;
  const max = category.yearExtent.max;
  const undated = records.filter((record) => record.yearNumber == null);
  const numeric = records.filter((record) => record.yearNumber != null);
  const bounded = min != null && max != null;
  const from = bounded ? readBound(searchParams.get("from"), min, min, max) : null;
  const to = bounded ? readBound(searchParams.get("to"), max, min, max) : null;
  const low = from != null && to != null ? Math.min(from, to) : null;
  const high = from != null && to != null ? Math.max(from, to) : null;
  const visible = numeric
    .filter((record) => (low == null || high == null ? true : overlaps(record, low, high)))
    .sort((a, b) => (a.yearNumber ?? 0) - (b.yearNumber ?? 0) || a.name.localeCompare(b.name, "ru"));
  const axisStart = min == null ? null : decadeStart(min);

  return (
    <main className="branch timeline-page">
      <header className="branch-head" style={{ viewTransitionName: `category-${category.slug}` }}>
        <p className="kicker">{category.count} контроллеров</p>
        <h1>{category.label}</h1>
        <p className="lede">{category.description}</p>
      </header>
      <p className="quiet">
        {visible.length} в диапазоне
        {undated.length ? ` · ${undated.length} без даты` : ""}
      </p>
      {visible.length ? null : <p className="timeline-empty">В этом диапазоне нет контроллеров.</p>}
      <PhysicalTimeline dated={visible} undated={undated} axisStart={axisStart} axisEnd={high} />
      {bounded ? <YearRange min={min} max={max} records={records} /> : null}
    </main>
  );
}
