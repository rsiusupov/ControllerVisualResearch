"use client";

import { Button as KoalaButton, type ButtonProps } from "@/components/ui/button/button";

export function Button({ variant = "outline", size = "sm", ...props }: ButtonProps) {
  return <KoalaButton variant={variant} size={size} {...props} />;
}
