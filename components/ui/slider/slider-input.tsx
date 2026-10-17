"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { tv, type VariantProps } from "@/lib/tv"
import { createContext } from "@/lib/create-context"
import { useControlSize, type ControlSize } from "@/lib/density"
import { useFieldContext } from "@/lib/field-context"

export const sliderInputVariants = tv({
  slots: {
    root: [
      "flex w-full items-stretch gap-1.5",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    ],
    value: [
      "relative flex shrink-0 items-center gap-0.5 rounded-md bg-foreground/6",
      "cursor-ew-resize has-[input:focus]:cursor-text",
      "transition-[background-color,box-shadow] duration-fast ease-out",
      "hover:bg-foreground/8",
      "focus-within:bg-foreground/8 focus-within:outline focus-within:outline-brand focus-within:-outline-offset-1 focus-within:brand-ring",
      "autofill-tint",
    ],
    input: [
      "h-full min-w-[1ch] flex-initial field-sizing-content bg-transparent outline-none",
      "text-sm pointer-coarse:text-base tabular-nums text-foreground",
      "cursor-[inherit] autofill-clear",
      "selection:bg-brand/25",
    ],
    suffix: "shrink-0 select-none text-sm tabular-nums text-muted-foreground",
    track: [
      "group/track relative flex min-w-0 flex-1 touch-none select-none items-center",
      "[--slider-input-pull-l:0px] [--slider-input-pull-r:0px]",
    ],
    rail: [
      "pointer-events-none absolute top-1/2 -translate-y-1/2",
      "left-[calc(var(--slider-input-pull-l)*-1)] right-[calc(var(--slider-input-pull-r)*-1)]",
      "overflow-hidden rounded-md bg-foreground/6",
      "transition-[height,background-color,box-shadow,left,right] duration-base ease-out",
      "group-data-[dragging]/track:transition-[height,background-color,box-shadow]",
      "group-hover/track:bg-foreground/8 group-active/track:bg-foreground/8",
    ],
    fill: [
      "absolute inset-y-0 left-0",
      "transition-[background-color] duration-fast ease-out",
    ],
    ticks: "absolute inset-0",
    tick: [
      "absolute top-1/2 h-1/4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/10",
      "left-[calc(var(--slider-input-thumb)/2_+_(100%_-_var(--slider-input-thumb))_*_var(--slider-input-tick))]",
      "transition-opacity duration-fast ease-out",
      "data-[filled]:opacity-0",
      "group-hover/track:data-[filled]:opacity-100 group-active/track:data-[filled]:opacity-100",
      "group-has-[:focus-visible]/track:data-[filled]:opacity-100",
    ],
    thumb: [
      "group/thumb flex w-(--slider-input-thumb) items-center justify-center outline-none",
      "translate-x-[calc(var(--slider-input-pull-r)-var(--slider-input-pull-l))]",
      "transition-[height,translate] duration-base ease-out",
      "group-data-[dragging]/track:transition-[height]",
    ],
    pill: [
      "h-full w-1 rounded-full",
      "transition-[background-color,box-shadow,opacity] duration-fast ease-out",
      "group-data-[covered]/thumb:opacity-0",
    ],
    label: [
      "pointer-events-none absolute left-(--slider-input-thumb) top-1/2 max-w-2/3 -translate-y-1/2 truncate",
      "text-sm text-muted-foreground",
      "translate-x-[calc(var(--slider-input-pull-l)*-1)]",
      "transition-[translate] duration-base ease-out group-data-[dragging]/track:transition-none",
    ],
    readout: [
      "pointer-events-none absolute right-(--slider-input-thumb) top-1/2 -translate-y-1/2",
      "flex items-baseline gap-0.5 whitespace-nowrap",
      "text-sm tabular-nums text-foreground",
      "translate-x-(--slider-input-pull-r)",
      "transition-[translate] duration-base ease-out group-data-[dragging]/track:transition-none",
    ],
  },
  variants: {
    size: {
      sm: { root: "h-8", value: "w-16 px-2.5" },
      md: { root: "h-9", value: "w-18 px-3" },
      lg: { root: "h-10", value: "w-20 px-3" },
    },
    variant: {
      default: {},
      brand: {},
    },
    field: {
      false: {
        track: "cursor-pointer [--slider-input-thumb:calc(var(--spacing)*4)]",
        fill: "w-[calc(var(--slider-input-thumb)/2_+_(100%_-_var(--slider-input-thumb))_*_var(--slider-input-fraction))]",
        thumb: "cursor-pointer",
        pill: [
          "group-focus-visible/thumb:ring-2 group-focus-visible/thumb:ring-brand",
          "group-focus-visible/thumb:ring-offset-1 group-focus-visible/thumb:ring-offset-background",
        ],
      },
      true: {
        track: "cursor-ew-resize",
        rail: [
          "h-full",
          "group-has-[:focus-visible]/track:outline group-has-[:focus-visible]/track:outline-brand",
          "group-has-[:focus-visible]/track:-outline-offset-1 group-has-[:focus-visible]/track:brand-ring",
        ],
        fill: "w-[calc(var(--slider-input-thumb)_+_(100%_-_var(--slider-input-thumb))_*_var(--slider-input-fraction))] rounded-md shadow-xs",
        ticks:
          "[mask-image:linear-gradient(to_right,transparent_calc(var(--slider-input-label-end,0px)+var(--spacing)*1),black_calc(var(--slider-input-label-end,0px)+var(--spacing)*6),black_calc(var(--slider-input-value-start,100%)-var(--spacing)*6),transparent_calc(var(--slider-input-value-start,100%)-var(--spacing)*1))]",
        thumb: "cursor-[inherit]",
      },
    },
  },
  compoundVariants: [
    {
      field: false,
      size: "sm",
      class: {
        rail: "h-4 group-hover/track:h-8 group-active/track:h-8 group-has-[:focus-visible]/track:h-8",
        thumb: "h-2.5 group-hover/track:h-5 group-active/track:h-5 group-has-[:focus-visible]/track:h-5",
      },
    },
    {
      field: false,
      size: "md",
      class: {
        rail: "h-4.5 group-hover/track:h-9 group-active/track:h-9 group-has-[:focus-visible]/track:h-9",
        thumb: "h-3 group-hover/track:h-5.5 group-active/track:h-5.5 group-has-[:focus-visible]/track:h-5.5",
      },
    },
    {
      field: false,
      size: "lg",
      class: {
        rail: "h-5 group-hover/track:h-10 group-active/track:h-10 group-has-[:focus-visible]/track:h-10",
        thumb: "h-3.5 group-hover/track:h-6 group-active/track:h-6 group-has-[:focus-visible]/track:h-6",
      },
    },
    { field: true, size: "sm", class: { track: "[--slider-input-thumb:calc(var(--spacing)*2.5)]", thumb: "h-3" } },
    { field: true, size: "md", class: { track: "[--slider-input-thumb:calc(var(--spacing)*3)]", thumb: "h-3.5" } },
    { field: true, size: "lg", class: { track: "[--slider-input-thumb:calc(var(--spacing)*3.5)]", thumb: "h-4" } },
    {
      field: false,
      variant: "default",
      class: {
        fill: "bg-foreground/8",
        pill: "bg-muted-foreground group-hover/track:bg-foreground group-active/track:bg-foreground",
      },
    },
    { field: false, variant: "brand", class: { fill: "bg-brand/15", pill: "bg-brand" } },
    {
      field: true,
      variant: "default",
      class: {
        fill: "bg-foreground/5 group-hover/track:bg-foreground/6 group-active/track:bg-foreground/7",
        pill: "bg-foreground/25 group-hover/track:bg-foreground/45 group-active/track:bg-foreground/45",
      },
    },
    {
      field: true,
      variant: "brand",
      class: {
        fill: "bg-brand/12 group-hover/track:bg-brand/16 group-active/track:bg-brand/20",
        pill: "bg-brand",
      },
    },
  ],
  defaultVariants: {
    size: "md",
    variant: "default",
    field: false,
  },
})

type SliderInputSlots = ReturnType<typeof sliderInputVariants>

function decimalsOf(step: number): number {
  const s = String(step)
  const dot = s.indexOf(".")
  return dot === -1 ? 0 : s.length - dot - 1
}

function normalize(value: number, min: number, max: number, step: number, decimals: number) {
  const snapped = min + Math.round((value - min) / step) * step
  const clamped = Math.min(max, Math.max(min, snapped))
  return Number(clamped.toFixed(decimals))
}

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node)
  else if (ref) ref.current = node
}

interface SliderInputContextValue {
  slots: SliderInputSlots
  size: ControlSize
  variant: VariantProps<typeof sliderInputVariants>["variant"]
  value: number
  min: number
  max: number
  step: number
  decimals: number
  disabled: boolean
  setValue: (next: number) => void
  commit: (next: number) => void
  formatValue: ((value: number) => string) | undefined
  inputId: string | undefined
  label: string | undefined
  labelledBy: string | undefined
  describedBy: string | undefined
  name: string | undefined
}

const [SliderInputProvider, useSliderInputContext] =
  createContext<SliderInputContextValue>("SliderInput")

interface SliderInputFieldContextValue {
  slots: SliderInputSlots
  labelId: string
  setLabelEl: (node: HTMLSpanElement | null) => void
  setReadoutEl: (node: HTMLSpanElement | null) => void
}

const SliderInputFieldContext = React.createContext<SliderInputFieldContextValue | null>(null)
SliderInputFieldContext.displayName = "SliderInputFieldContext"

export interface SliderInputProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange">,
    Omit<VariantProps<typeof sliderInputVariants>, "size" | "field"> {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  onValueCommit?: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  size?: ControlSize
  name?: string
  formatValue?: (value: number) => string
  id?: string
}

export function SliderInput({
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  size,
  variant,
  name,
  formatValue,
  id,
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SliderInputProps) {
  const field = useFieldContext()
  const resolvedSize = useControlSize(size)
  const slots = sliderInputVariants({ size: resolvedSize, variant })
  const decimals = React.useMemo(() => decimalsOf(step), [step])

  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState(() => defaultValue ?? min)
  const value = isControlled ? valueProp : internal
  const resolvedDisabled = disabled ?? field?.disabled ?? false

  const setValue = React.useCallback(
    (next: number) => {
      const normalized = normalize(next, min, max, step, decimals)
      if (normalized === value) return
      if (!isControlled) setInternal(normalized)
      onValueChange?.(normalized)
    },
    [decimals, isControlled, max, min, onValueChange, step, value],
  )

  const commit = React.useCallback(
    (next: number) => onValueCommit?.(normalize(next, min, max, step, decimals)),
    [decimals, max, min, onValueCommit, step],
  )

  return (
    <SliderInputProvider
      slots={slots}
      size={resolvedSize}
      variant={variant}
      value={value}
      min={min}
      max={max}
      step={step}
      decimals={decimals}
      disabled={resolvedDisabled}
      setValue={setValue}
      commit={commit}
      formatValue={formatValue}
      inputId={id ?? field?.id}
      label={ariaLabel}
      labelledBy={ariaLabelledBy ?? field?.labelledBy}
      describedBy={ariaDescribedBy ?? field?.describedBy}
      name={name}
    >
      <div
        role="group"
        data-slot="slider-input"
        data-disabled={resolvedDisabled ? "" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? field?.labelledBy}
        className={slots.root({ className })}
        {...props}
      >
        {children ?? (
          <>
            <SliderInputValue />
            <SliderInputTrack />
          </>
        )}
      </div>
    </SliderInputProvider>
  )
}

const SCRUB_THRESHOLD = 3
const SCRUB_SPAN = 240

export interface SliderInputValueProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "size"> {
  suffix?: React.ReactNode
  formatValue?: (value: number) => string
  boxClassName?: string
}

export function SliderInputValue(props: SliderInputValueProps) {
  const fieldTrack = React.useContext(SliderInputFieldContext)
  return fieldTrack ? (
    <SliderInputReadout {...props} fieldTrack={fieldTrack} />
  ) : (
    <SliderInputBox {...props} />
  )
}

function SliderInputBox({
  suffix,
  formatValue,
  boxClassName,
  className,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: SliderInputValueProps) {
  const ctx = useSliderInputContext("SliderInputValue")
  const { slots, value, min, max, step, decimals, disabled, setValue, commit } = ctx
  const inputRef = React.useRef<HTMLInputElement>(null)
  const format = formatValue ?? ctx.formatValue

  const [draft, setDraft] = React.useState<string | null>(null)
  const display = draft ?? (format ? format(value) : value.toFixed(decimals))

  const scrub = React.useRef<{ x: number; start: number; active: boolean; id: number } | null>(null)

  function parse(raw: string): number | null {
    const n = Number(raw.trim())
    return raw.trim() === "" || Number.isNaN(n) ? null : n
  }

  function finishEditing(revert: boolean) {
    if (draft !== null && !revert) {
      const parsed = parse(draft)
      if (parsed !== null) {
        setValue(parsed)
        commit(parsed)
      }
    }
    setDraft(null)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return
    setDraft(raw)
    const parsed = parse(raw)
    if (parsed !== null && parsed >= min && parsed <= max) setValue(parsed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault()
      const base = parse(draft ?? "") ?? value
      const next = normalize(
        base + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1),
        min,
        max,
        step,
        decimals,
      )
      setValue(next)
      commit(next)
      setDraft(next.toFixed(decimals))
      requestAnimationFrame(() => inputRef.current?.select())
    } else if (e.key === "Enter") {
      e.preventDefault()
      inputRef.current?.blur()
    } else if (e.key === "Escape") {
      e.preventDefault()
      finishEditing(true)
      requestAnimationFrame(() => inputRef.current?.blur())
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || e.button !== 0 || document.activeElement === inputRef.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    scrub.current = { x: e.clientX, start: value, active: false, id: e.pointerId }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = scrub.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    if (!s.active && Math.abs(dx) < SCRUB_THRESHOLD) return
    s.active = true
    setValue(s.start + (dx / SCRUB_SPAN) * (max - min))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = scrub.current
    if (!s || s.id !== e.pointerId) return
    scrub.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (s.active) {
      commit(value)
    } else {
      inputRef.current?.focus()
    }
  }

  return (
    <div
      data-slot="slider-input-value"
      className={slots.value({ className: boxClassName })}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        scrub.current = null
      }}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode={decimals > 0 || min < 0 ? "decimal" : "numeric"}
        autoComplete="off"
        spellCheck={false}
        role="spinbutton"
        id={ctx.inputId}
        aria-label={ctx.label}
        aria-labelledby={ctx.label ? undefined : ctx.labelledBy}
        aria-describedby={ctx.describedBy}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        disabled={disabled}
        data-slot="slider-input-field"
        className={slots.input({ className })}
        value={display}
        {...props}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          setDraft(value.toFixed(decimals))
          requestAnimationFrame(() => inputRef.current?.select())
          onFocus?.(e)
        }}
        onBlur={(e) => {
          finishEditing(false)
          onBlur?.(e)
        }}
      />
      {suffix != null && (
        <span data-slot="slider-input-suffix" className={slots.suffix()} aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  )
}

function SliderInputReadout({
  suffix,
  formatValue,
  boxClassName,
  className,
  fieldTrack,
}: SliderInputValueProps & { fieldTrack: SliderInputFieldContextValue }) {
  const ctx = useSliderInputContext("SliderInputValue")
  const format = formatValue ?? ctx.formatValue
  const { slots, setReadoutEl } = fieldTrack

  return (
    <span
      ref={setReadoutEl}
      data-slot="slider-input-readout"
      aria-hidden
      className={slots.readout({ className: cn(boxClassName, className) })}
    >
      {format ? format(ctx.value) : ctx.value.toFixed(ctx.decimals)}
      {suffix != null && (
        <span data-slot="slider-input-suffix" className={slots.suffix()}>
          {suffix}
        </span>
      )}
    </span>
  )
}

export type SliderInputLabelProps = React.ComponentProps<"span">

export function SliderInputLabel({ className, ref, ...props }: SliderInputLabelProps) {
  const fieldTrack = React.useContext(SliderInputFieldContext)
  if (!fieldTrack) {
    throw new Error("`SliderInputLabel` must be used within `SliderInputTrack`")
  }
  const { setLabelEl } = fieldTrack

  const composedRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      setLabelEl(node)
      assignRef(ref, node)
    },
    [ref, setLabelEl],
  )

  return (
    <span
      id={fieldTrack.labelId}
      data-slot="slider-input-label"
      className={fieldTrack.slots.label({ className })}
      {...props}
      ref={composedRef}
    />
  )
}

const MAX_PULL = 6
const PULL_SOFTNESS = 40
const MAX_TICKS = 64
const PILL_CLEARANCE = 4

function tickStops(
  ticks: boolean | number | undefined,
  min: number,
  max: number,
  step: number,
): number[] {
  if (!ticks || max <= min) return []
  const every = ticks === true ? step : ticks
  if (!(every > 0)) return []
  const count = Math.floor((max - min) / every + 1e-9)
  if (count > MAX_TICKS) return []
  const decimals = Math.max(decimalsOf(step), decimalsOf(every))
  const stops: number[] = []
  for (let i = 1; i <= count; i++) {
    const stop = Number((min + i * every).toFixed(decimals))
    if (stop < max) stops.push(stop)
  }
  return stops
}

interface TrackGeometry {
  width: number
  thumb: number
  label: [number, number] | null
  readout: [number, number] | null
}

function sameSpan(a: [number, number] | null, b: [number, number] | null) {
  return a === b || (a != null && b != null && a[0] === b[0] && a[1] === b[1])
}

function spanOf(node: HTMLElement | null): [number, number] | null {
  return node ? [node.offsetLeft, node.offsetLeft + node.offsetWidth] : null
}

export interface SliderInputTrackProps
  extends Omit<
    React.ComponentProps<typeof SliderPrimitive.Root>,
    | "asChild"
    | "value"
    | "defaultValue"
    | "onValueChange"
    | "onValueCommit"
    | "min"
    | "max"
    | "step"
    | "disabled"
    | "orientation"
    | "name"
  > {
  ticks?: boolean | number
}

export function SliderInputTrack({
  className,
  style,
  children,
  ticks,
  ref,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  ...props
}: SliderInputTrackProps) {
  const ctx = useSliderInputContext("SliderInputTrack")
  const { size, variant, value, min, max, step, disabled, setValue, commit } = ctx
  const fraction = max === min ? 0 : (value - min) / (max - min)

  const field = React.Children.toArray(children).length > 0
  const slots = React.useMemo(
    () => sliderInputVariants({ size, variant, field }),
    [size, variant, field],
  )

  const labelId = React.useId()
  const [labelEl, setLabelEl] = React.useState<HTMLSpanElement | null>(null)
  const [readoutEl, setReadoutEl] = React.useState<HTMLSpanElement | null>(null)
  const trackRef = React.useRef<HTMLSpanElement | null>(null)
  const thumbRef = React.useRef<HTMLSpanElement | null>(null)
  const [geometry, setGeometry] = React.useState<TrackGeometry | null>(null)

  React.useEffect(() => {
    const track = trackRef.current
    if (!field || !track) return
    const observer = new ResizeObserver(() => {
      const next: TrackGeometry = {
        width: track.clientWidth,
        thumb: thumbRef.current?.offsetWidth ?? 0,
        label: spanOf(labelEl),
        readout: spanOf(readoutEl),
      }
      setGeometry((prev) =>
        prev &&
        prev.width === next.width &&
        prev.thumb === next.thumb &&
        sameSpan(prev.label, next.label) &&
        sameSpan(prev.readout, next.readout)
          ? prev
          : next,
      )
    })
    observer.observe(track)
    if (thumbRef.current) observer.observe(thumbRef.current)
    if (labelEl) observer.observe(labelEl)
    if (readoutEl) observer.observe(readoutEl)
    return () => observer.disconnect()
  }, [field, labelEl, readoutEl])

  const covered = React.useMemo(() => {
    if (!field || !geometry) return false
    const centre = geometry.thumb / 2 + (geometry.width - geometry.thumb) * fraction
    return [geometry.label, geometry.readout].some(
      (span) => span != null && centre > span[0] - PILL_CLEARANCE && centre < span[1] + PILL_CLEARANCE,
    )
  }, [field, fraction, geometry])

  const composedRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      trackRef.current = node
      assignRef(ref, node)
    },
    [ref],
  )

  const drag = React.useRef<{ id: number; still: boolean } | null>(null)

  function pull(track: HTMLElement, overshoot: number) {
    const amount = MAX_PULL * (1 - Math.exp(-Math.abs(overshoot) / PULL_SOFTNESS))
    track.style.setProperty("--slider-input-pull-r", `${overshoot > 0 ? amount : 0}px`)
    track.style.setProperty("--slider-input-pull-l", `${overshoot < 0 ? amount : 0}px`)
  }

  function release(e: React.PointerEvent<HTMLSpanElement>) {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    const track = e.currentTarget
    track.removeAttribute("data-dragging")
    track.style.removeProperty("--slider-input-pull-r")
    track.style.removeProperty("--slider-input-pull-l")
  }

  const fieldContext = React.useMemo<SliderInputFieldContextValue>(
    () => ({ slots, labelId, setLabelEl, setReadoutEl }),
    [slots, labelId],
  )

  const tickValues = tickStops(ticks, min, max, step)

  return (
    <SliderPrimitive.Root
      ref={composedRef}
      data-slot="slider-input-track"
      className={slots.track({ className })}
      style={
        {
          ...style,
          "--slider-input-fraction": fraction,
          ...(geometry?.label && { "--slider-input-label-end": `${geometry.label[1]}px` }),
          ...(geometry?.readout && { "--slider-input-value-start": `${geometry.readout[0]}px` }),
        } as React.CSSProperties
      }
      value={[value]}
      onValueChange={([next]) => setValue(next)}
      onValueCommit={([next]) => commit(next)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      name={ctx.name}
      {...props}
      onPointerDown={(e) => {
        onPointerDown?.(e)
        if (e.defaultPrevented || disabled || e.button !== 0) return
        drag.current = {
          id: e.pointerId,
          still: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        }
        e.currentTarget.setAttribute("data-dragging", "")
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e)
        const d = drag.current
        if (!d || d.id !== e.pointerId || d.still) return
        const rect = e.currentTarget.getBoundingClientRect()
        const overshoot =
          e.clientX > rect.right ? e.clientX - rect.right : e.clientX < rect.left ? e.clientX - rect.left : 0
        pull(e.currentTarget, overshoot)
      }}
      onPointerUp={(e) => {
        onPointerUp?.(e)
        release(e)
      }}
      onPointerCancel={(e) => {
        onPointerCancel?.(e)
        release(e)
      }}
      onLostPointerCapture={(e) => {
        onLostPointerCapture?.(e)
        release(e)
      }}
    >
      <span data-slot="slider-input-rail" className={slots.rail()} aria-hidden>
        <span data-slot="slider-input-fill" className={slots.fill()} />
        {tickValues.length > 0 && (
          <span data-slot="slider-input-ticks" className={slots.ticks()}>
            {tickValues.map((stop) => (
              <span
                key={stop}
                data-slot="slider-input-tick"
                data-filled={stop <= value ? "" : undefined}
                className={slots.tick()}
                style={{ "--slider-input-tick": (stop - min) / (max - min) } as React.CSSProperties}
              />
            ))}
          </span>
        )}
      </span>
      {field && (
        <SliderInputFieldContext.Provider value={fieldContext}>
          {children}
        </SliderInputFieldContext.Provider>
      )}
      <SliderPrimitive.Thumb
        ref={thumbRef}
        data-slot="slider-input-thumb"
        data-covered={covered ? "" : undefined}
        className={slots.thumb()}
        aria-label={ctx.label}
        aria-labelledby={ctx.label ? undefined : labelEl ? labelId : ctx.labelledBy}
        aria-describedby={ctx.describedBy}
        aria-valuetext={ctx.formatValue?.(value)}
      >
        <span data-slot="slider-input-pill" className={slots.pill()} />
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  )
}
