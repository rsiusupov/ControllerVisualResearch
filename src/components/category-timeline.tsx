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
      <PhysicalTimeline
        dated={visible}
        undated={undated}
        axisStart={axisStart}
        axisEnd={high}
        empty={visible.length === 0}
        origin={{
          slug: category.slug,
          count: category.count,
          label: category.label,
          description: category.description,
        }}
      />
      {bounded ? <YearRange min={min} max={max} records={records} /> : null}
    </main>
  );
}
