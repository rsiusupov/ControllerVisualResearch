"use client";

import { useRef } from "react";
import { Slider } from "@/components/ui/slider";

export function RangeSlider({
  min,
  max,
  value,
  onValueChange,
  formatValue,
  label,
}: {
  min: number;
  max: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  formatValue: (value: number) => string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onKeyDownCapture={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.getAttribute("role") !== "slider") return;
        const decrease = event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "PageDown";
        const increase = event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "PageUp";
        const home = event.key === "Home";
        const end = event.key === "End";
        if (!decrease && !increase && !home && !end) return;
        const thumbs = [...(ref.current?.querySelectorAll<HTMLElement>('[role="slider"]') ?? [])];
        const index = thumbs.indexOf(target);
        if (index < 0) return;
        event.preventDefault();
        event.stopPropagation();
        const current = value[index] ?? min;
        const jump = event.shiftKey || event.key.startsWith("Page") ? 10 : 1;
        let next = current;
        if (home) next = min;
        else if (end) next = max;
        else if (decrease) next = current - jump;
        else next = current + jump;
        next = Math.min(max, Math.max(min, next));
        const pair: [number, number] = index === 0 ? [next, value[1]] : [value[0], next];
        onValueChange([Math.min(...pair), Math.max(...pair)]);
      }}
    >
      <Slider
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={0}
        value={value}
        variant="brand"
        tooltip
        formatValue={formatValue}
        aria-label={label}
        thumbLabels={["От", "До"]}
        onValueChange={(next) => {
          const from = next[0];
          const to = next[1] ?? next[0];
          if (from == null || to == null) return;
          onValueChange([Math.min(from, to), Math.max(from, to)]);
        }}
      />
    </div>
  );
}
