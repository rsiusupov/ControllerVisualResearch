import { tv } from "@/lib/tv"
import { hitBox, hitCoarse, hitX } from "@/lib/hit-area"

export const buttonVariants = tv({
  base: [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium",
    "transition duration-fast ease-out",
    "active:scale-[0.96]",
    "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  variants: {
    variant: {
      primary: "bg-brand text-brand-foreground font-semibold shadow-xs hover:bg-brand/90",
      secondary:
        "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
      neutral: "bg-foreground text-background shadow-xs hover:bg-foreground/85",
      outline:
        "border border-border bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      overlay:
        "border border-white/15 bg-black/45 text-white shadow-xs hover:bg-black/65 hover:text-white focus-visible:ring-white focus-visible:ring-offset-transparent",
      destructive:
        "bg-destructive/10 text-destructive-strong shadow-xs hover:bg-destructive/20 focus-visible:ring-destructive/40",
      destructiveGhost:
        "text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5 has-[>[data-slot=button-label]_svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
      sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5 has-[>[data-slot=button-label]_svg]:px-2.5",
      md: "h-9 px-4 py-2 has-[>svg]:px-3 has-[>[data-slot=button-label]_svg]:px-3",
      lg: "h-10 px-5 has-[>svg]:px-4 has-[>[data-slot=button-label]_svg]:px-4",
      xl: "h-11 px-6 text-base has-[>svg]:px-5 has-[>[data-slot=button-label]_svg]:px-5 [&_svg:not([class*='size-'])]:size-5",
    },
    iconOnly: {
      true: "",
      false: "",
    },
    tone: {
      default: "",
      onMedia: "focus-visible:ring-white focus-visible:ring-offset-transparent",
      onInverse: "focus-visible:ring-background focus-visible:ring-offset-transparent",
    },
  },
  compoundVariants: [
    { tone: "onMedia", variant: ["primary", "secondary", "neutral"], className: "bg-white text-neutral-950 shadow-xs hover:bg-white/90" },
    { tone: "onMedia", variant: "outline", className: "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" },
    { tone: "onMedia", variant: "ghost", className: "text-white hover:bg-white/20 hover:text-white" },
    { tone: "onInverse", variant: ["primary", "secondary", "neutral"], className: "bg-background text-foreground shadow-xs hover:bg-background/90" },
    { tone: "onInverse", variant: "outline", className: "border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background" },
    { tone: "onInverse", variant: "ghost", className: "text-background hover:bg-background/20 hover:text-background" },
    { size: "xs", iconOnly: true, className: `w-7 gap-0 rounded-[calc(var(--radius)*0.625)] px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0 ${hitBox}` },
    { size: "sm", iconOnly: true, className: `w-8 gap-0 rounded-md px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0 ${hitBox}` },
    { size: "md", iconOnly: true, className: "w-9 gap-0 rounded-[calc(var(--radius)*0.875)] px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },
    { size: "lg", iconOnly: true, className: "w-10 gap-0 rounded-lg px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },
    { size: "xl", iconOnly: true, className: "w-11 gap-0 rounded-[calc(var(--radius)*1.125)] px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },

    { size: ["xs", "sm"], iconOnly: false, className: hitX },
    { size: ["md", "lg"], className: hitCoarse },
  ],
  defaultVariants: {
    variant: "primary",
    size: "md",
    iconOnly: false,
    tone: "default",
  },
})
