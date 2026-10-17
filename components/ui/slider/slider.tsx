"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { tv, type VariantProps } from "@/lib/tv"
import { hitBox } from "@/lib/hit-area"

export const sliderVariants = tv({
  slots: {
    root: [
      "relative flex touch-none select-none items-center",
      "data-[orientation=horizontal]:w-full",
      "data-[orientation=vertical]:h-48 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    ],
    track: [
      "relative grow overflow-hidden rounded-full bg-secondary",
      "data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
    ],
    range: [
      "absolute rounded-full",
      "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
    ],
    thumb: [
      "group/thumb relative block shrink-0 rounded-full border-2 bg-background shadow-sm",
      "cursor-grab active:cursor-grabbing",
      "transition-[transform,box-shadow,border-color] duration-fast ease-out active:scale-[0.96]",
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "data-[disabled]:cursor-not-allowed",
      hitBox,
    ],
    tooltip: [
      "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2",
      "rounded-md px-2 py-1 text-xs font-medium tabular-nums shadow-sm",
      "whitespace-nowrap",
      "opacity-0 translate-y-1 transition-[opacity,transform] duration-fast ease-out",
      "group-hover/thumb:opacity-100 group-hover/thumb:translate-y-0",
      "group-focus/thumb:opacity-100 group-focus/thumb:translate-y-0",
    ],
  },
  variants: {
    size: {
      sm: {
        track: "data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1",
        thumb: "size-4",
      },
      md: {
        track: "data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5",
        thumb: "size-5",
      },
      lg: {
        track: "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:w-2.5",
        thumb: "size-6",
      },
    },
    variant: {
      default: {
        range: "bg-primary",
        thumb: "border-primary",
        tooltip: "bg-primary text-primary-foreground",
      },
      brand: {
        range: "bg-brand",
        thumb: "border-brand",
        tooltip: "bg-brand text-brand-foreground",
      },
      success: {
        range: "bg-success",
        thumb: "border-success",
        tooltip: "bg-success text-white",
      },
      warning: {
        range: "bg-warning",
        thumb: "border-warning",
        tooltip: "bg-warning text-white",
      },
      destructive: {
        range: "bg-destructive",
        thumb: "border-destructive",
        tooltip: "bg-destructive text-white",
      },
    },
    shape: {
      round: {},
      square: {
        track: "rounded-sm",
        range: "rounded-sm",
        thumb: "rounded-[calc(var(--radius-sm)*0.7)]",
      },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
    shape: "round",
  },
})

export interface SliderProps
  extends Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "asChild">,
    VariantProps<typeof sliderVariants> {
  tooltip?: boolean
  formatValue?: (value: number) => React.ReactNode
  static?: boolean
  thumbLabels?: string[]
}

export function Slider({
  className,
  size,
  variant,
  shape,
  tooltip = false,
  formatValue = (v) => v,
  static: isStatic = false,
  thumbLabels,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  ...props
}: SliderProps) {
  const slots = sliderVariants({ size, variant, shape })

  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<number[]>(
    defaultValue ?? value ?? [min],
  )
  const current = value ?? internal

  function handleValueChange(next: number[]) {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={slots.root({ className })}
      value={value}
      defaultValue={defaultValue}
      onValueChange={handleValueChange}
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className={slots.track()}>
        <SliderPrimitive.Range data-slot="slider-range" className={slots.range()} />
      </SliderPrimitive.Track>
      {current.map((thumbValue, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-slot="slider-thumb"
          aria-label={thumbLabels?.[i]}
          className={slots.thumb({ className: cn(isStatic && "active:scale-100") })}
        >
          {tooltip && (
            <span data-slot="slider-tooltip" className={slots.tooltip()} aria-hidden>
              {formatValue(thumbValue)}
            </span>
          )}
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  )
}
