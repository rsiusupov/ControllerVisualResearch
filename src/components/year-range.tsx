"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { StudyRecord } from "@/src/lib/study";
import { formatYear, readBound, yearBins } from "@/src/lib/years";
import { Button } from "@/src/ui/button";
import { RangeSlider } from "@/src/ui/range-slider";

export function YearRange({
  min,
  max,
  records,
}: {
  min: number;
  max: number;
  records: StudyRecord[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = readBound(searchParams.get("from"), min, min, max);
  const to = readBound(searchParams.get("to"), max, min, max);
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const bins = useMemo(() => yearBins(records, min, max), [records, min, max]);

  function write(nextFrom: number, nextTo: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFrom === min && nextTo === max) {
      params.delete("from");
      params.delete("to");
    } else {
      params.set("from", String(nextFrom));
      params.set("to", String(nextTo));
    }
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  return (
    <div className="year-bar">
      <div className="year-readout">
        <span>
          От <strong>{formatYear(low)}</strong>
        </span>
        <span className="quiet">
          {low === min && high === max ? "весь период" : `${formatYear(low)} — ${formatYear(high)}`}
        </span>
        <span>
          До <strong>{formatYear(high)}</strong>
        </span>
        <Button type="button" variant="ghost" onClick={() => write(min, max)}>
          Весь период
        </Button>
      </div>
      <div className="histogram" aria-hidden="true">
        {bins.map((height, index) => (
          <span key={index} style={{ height: `${Math.max(6, height * 100)}%` }} />
        ))}
      </div>
      {min === max ? null : (
        <RangeSlider
          min={min}
          max={max}
          value={[low, high]}
          formatValue={formatYear}
          label="Диапазон лет"
          onValueChange={([nextFrom, nextTo]) => write(nextFrom, nextTo)}
        />
      )}
    </div>
  );
}
