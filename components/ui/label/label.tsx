"use client"

import * as React from "react"

import { tv } from "@/lib/tv"
import { useFieldContext } from "@/lib/field-context"
import { useFieldGroupContext } from "@/lib/field-group-context"

const labelVariants = tv({
  slots: {
    root: "flex items-center gap-1 text-sm font-normal text-muted-foreground select-none transition-opacity duration-fast ease-out",
    requiredMark: "text-destructive",
    hint: "text-xs text-pretty text-muted-foreground transition-colors duration-fast ease-out",
  },
  variants: {
    disabled: {
      true: { root: "opacity-50" },
    },
    hasError: {
      true: { hint: "text-destructive" },
    },
  },
})

export interface LabelProps extends React.ComponentPropsWithoutRef<"label"> {
  required?: boolean
  disabled?: boolean
}

function Label({
  className,
  children,
  required,
  disabled,
  htmlFor,
  id,
  ...props
}: LabelProps) {
  const field = useFieldContext()
  const resolvedRequired = required ?? field?.required ?? false
  const resolvedDisabled = disabled ?? field?.disabled ?? false
  const { root, requiredMark } = labelVariants({ disabled: resolvedDisabled })
  React.useEffect(() => field?.registerLabel?.(), [field])

  return (
    <label
      data-slot="label"
      id={id ?? field?.labelId}
      htmlFor={htmlFor ?? field?.id}
      className={root({ className })}
      {...props}
    >
      {children}
      {resolvedRequired ? (
        <>
          <span aria-hidden="true" className={requiredMark()}>
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      ) : null}
    </label>
  )
}

export interface HintProps extends React.ComponentPropsWithoutRef<"p"> {
  hasError?: boolean
}

function Hint({ className, hasError, id, ...props }: HintProps) {
  const field = useFieldContext()
  const group = useFieldGroupContext()
  const owner = field ?? group
  const resolvedError = hasError ?? owner?.hasError ?? false
  React.useEffect(() => owner?.registerHint?.(), [owner])

  return (
    <p
      data-slot="hint"
      id={id ?? owner?.hintId}
      className={labelVariants({ hasError: resolvedError }).hint({ className })}
      {...props}
    />
  )
}

export { Label, Hint, labelVariants }
