"use client"

import * as React from "react"

export interface FieldGroupContextValue {
  hintId: string
  describedBy: string | undefined
  registerHint: () => () => void
  hasError: boolean
  disabled: boolean
  required: boolean
}

const FieldGroupContext = React.createContext<FieldGroupContextValue | null>(null)
FieldGroupContext.displayName = "FieldGroupContext"

export const FieldGroupContextProvider = FieldGroupContext.Provider

export function useFieldGroupContext(): FieldGroupContextValue | null {
  return React.useContext(FieldGroupContext)
}
