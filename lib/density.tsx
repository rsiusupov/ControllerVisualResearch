"use client"

import * as React from "react"

export type Density = "comfortable" | "compact"

const DensityContext = React.createContext<Density>("compact")
DensityContext.displayName = "DensityContext"

export function DensityProvider({
  density,
  children,
}: {
  density: Density
  children: React.ReactNode
}) {
  return (
    <DensityContext.Provider value={density}>
      <div data-density={density} className="contents">
        {children}
      </div>
    </DensityContext.Provider>
  )
}

export function useDensity(density?: Density): Density {
  const context = React.useContext(DensityContext)
  return density ?? context
}

export type ControlSize = "sm" | "md" | "lg"

export type ButtonSize = "xs" | ControlSize | "xl"

const ControlSizeContext = React.createContext<ButtonSize | null>(null)
ControlSizeContext.displayName = "ControlSizeContext"

export function ControlSizeProvider({
  size,
  children,
}: {
  size: ButtonSize
  children: React.ReactNode
}) {
  return <ControlSizeContext.Provider value={size}>{children}</ControlSizeContext.Provider>
}

function toControlSize(size: ButtonSize): ControlSize {
  if (size === "xl") return "lg"
  if (size === "xs") return "sm"
  return size
}

export function useControlSizeContext(): ControlSize | null {
  const size = React.useContext(ControlSizeContext)
  return size ? toControlSize(size) : null
}

export function useControlSize(size?: ControlSize, density?: Density): ControlSize {
  const contextDensity = React.useContext(DensityContext)
  const contextSize = React.useContext(ControlSizeContext)
  if (size) return size
  if (density) return density === "compact" ? "sm" : "md"
  if (contextSize) return toControlSize(contextSize)
  return contextDensity === "compact" ? "sm" : "md"
}

export function useButtonSize(size?: ButtonSize, density?: Density): ButtonSize {
  const contextSize = React.useContext(ControlSizeContext)
  if (size) return size
  if (density) return density === "compact" ? "sm" : "md"
  if (contextSize) return contextSize
  return "md"
}
