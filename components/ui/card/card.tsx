"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { createContext } from "@/lib/create-context"
import { useDensity } from "@/lib/density"
import { tv, type VariantProps } from "@/lib/tv"

export const cardVariants = tv({
  slots: {
    root: "flex flex-col rounded-xl text-card-foreground",
    header: [
      "grid auto-rows-min items-start gap-1.5 [&:has([data-slot=card-action])]:grid-cols-[1fr_auto]",
      "[&:has(>[data-slot=card-action][data-wrap=narrow])]:@container/card-header @max-sm/card-header:[&>*]:col-span-full",
    ],
    title: "font-semibold leading-none",
    description: "text-sm text-muted-foreground [:where(&)]:text-pretty",
    action:
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end @max-sm/card-header:row-auto @max-sm/card-header:mt-2 @max-sm/card-header:justify-self-start",
    content: "",
    footer: "flex items-center",
    media: [
      "relative mx-2 aspect-video overflow-hidden rounded-md bg-muted",
      "[&>img]:size-full [&>img]:object-cover [&>video]:size-full [&>video]:object-cover",
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-black/10 dark:after:ring-white/10",
    ],
  },
  variants: {
    variant: {
      default: { root: "shadow-xs ring-1 ring-edge" },
      outline: { root: "shadow-none ring-1 ring-border" },
      elevated: { root: "bg-card shadow-lg [--surface:var(--card)]" },
    },
    density: {
      compact: {
        root: "gap-4 py-4",
        header: "px-4",
        content: "px-4",
        footer: "px-4",
        title: "text-base",
        media: "first:-mt-2 last:-mb-2",
      },
      comfortable: {
        root: "gap-6 py-6",
        header: "px-6",
        content: "px-6",
        footer: "px-6",
        title: "text-lg",
        media: "first:-mt-4 last:-mb-4",
      },
    },
    interactive: {
      true: {
        root: [
          "cursor-pointer text-left outline-none",
          "transition-[box-shadow] duration-fast ease-out motion-reduce:transition-none",
          "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ],
      },
      false: {},
    },
  },
  compoundVariants: [
    { variant: "default", interactive: true, class: { root: "hover:shadow-md hover:ring-foreground/20" } },
    { variant: "outline", interactive: true, class: { root: "hover:shadow-sm hover:ring-foreground/20" } },
    { variant: "elevated", interactive: true, class: { root: "hover:shadow-xl" } },
  ],
  defaultVariants: {
    variant: "default",
    density: "compact",
    interactive: false,
  },
})

type CardSlots = ReturnType<typeof cardVariants>
const [CardProvider, useCardContext] = createContext<{ slots: CardSlots }>("Card")

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {
  asChild?: boolean
}

export function Card({
  className,
  variant,
  density,
  interactive,
  asChild = false,
  ...props
}: CardProps) {
  const slots = cardVariants({ variant, density: useDensity(density), interactive })
  const Comp = asChild ? Slot.Root : "div"
  return (
    <CardProvider slots={slots}>
      <Comp data-slot="card" className={slots.root({ className })} {...props} />
    </CardProvider>
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardHeader")
  return <div data-slot="card-header" className={slots.header({ className })} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardTitle")
  return <div data-slot="card-title" className={slots.title({ className })} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardDescription")
  return (
    <div data-slot="card-description" className={slots.description({ className })} {...props} />
  )
}

export interface CardActionProps extends React.ComponentProps<"div"> {
  wrap?: "never" | "narrow"
}

export function CardAction({ className, wrap = "never", ...props }: CardActionProps) {
  const { slots } = useCardContext("CardAction")
  return (
    <div
      data-slot="card-action"
      data-wrap={wrap === "narrow" ? "narrow" : undefined}
      className={slots.action({ className })}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardContent")
  return <div data-slot="card-content" className={slots.content({ className })} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardFooter")
  return <div data-slot="card-footer" className={slots.footer({ className })} {...props} />
}

export function CardMedia({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardMedia")
  return <div data-slot="card-media" className={slots.media({ className })} {...props} />
}
