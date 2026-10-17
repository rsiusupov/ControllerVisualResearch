"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export const THEMES = ["light", "cream", "dark", "moonlight"] as const;
export type Theme = (typeof THEMES)[number];

export type ThemeSetting = Theme | "system";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={[...THEMES]}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
