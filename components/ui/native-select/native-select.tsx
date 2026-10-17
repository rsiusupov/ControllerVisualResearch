"use client"

import * as React from "react"
import { tv, type VariantProps } from "@/lib/tv"
import { useControlSize, type ControlSize, type Density } from "@/lib/density"
import { useFieldContext } from "@/lib/field-context"

export const nativeSelectVariants = tv({
  slots: {
    root: "group/native-select relative flex w-full",
    field: [
      "w-full min-w-0 cursor-pointer appearance-none truncate rounded-pill border border-input",
      "bg-[var(--surface,var(--background))] pl-3 text-sm pointer-coarse:text-base font-medium text-foreground shadow-xs",
      "transition-[border-color,box-shadow] duration-fast ease-out",
      "hover:border-ring/50",
      "outline-none focus:border-brand focus:brand-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:destructive-ring",
      "has-[option[value='']:checked]:font-normal has-[option[value='']:checked]:text-muted-foreground",
      "[&_option]:font-normal [&_option]:text-foreground [&_option:disabled]:text-muted-foreground",
      "dark:scheme-dark",
    ],
    icon: [
      "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground",
      "group-has-[select:disabled]/native-select:opacity-50",
    ],
  },
  variants: {
    size: {
      sm: { field: "h-8 pl-3 pr-8", icon: "right-2.75" },
      md: { field: "h-9 pr-9", icon: "right-3.25" },
      lg: { field: "h-10 pl-4 pr-10", icon: "right-3.75" },
    },
  },
  defaultVariants: { size: "md" },
})

export interface NativeSelectProps
  extends Omit<React.ComponentProps<"select">, "size" | "multiple">,
    Omit<VariantProps<typeof nativeSelectVariants>, "size"> {
  size?: ControlSize
  density?: Density
}

export function NativeSelect({
  className,
  size,
  density,
  id,
  disabled,
  required,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  children,
  ...props
}: NativeSelectProps) {
  const slots = nativeSelectVariants({ size: useControlSize(size, density) })
  const field = useFieldContext()
  return (
    <div data-slot="native-select" className={slots.root({ className })}>
      <select
        data-slot="native-select-field"
        id={id ?? field?.id}
        aria-describedby={ariaDescribedBy ?? field?.describedBy}
        aria-invalid={ariaInvalid ?? (field?.hasError || undefined)}
        disabled={disabled ?? field?.disabled}
        required={required ?? field?.required}
        className={slots.field()}
        {...props}
      >
        {children}
      </select>
      <i className={`iArrowDropDown ${slots.icon()}`} data-slot="native-select-icon" aria-hidden="true" />
    </div>
  )
}

export function NativeSelectOption(props: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />
}

export function NativeSelectOptGroup(props: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" {...props} />
}
