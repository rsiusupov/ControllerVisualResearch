import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { BloomRoot } from "@/src/components/bloom-root";
import { SiteHeader } from "@/src/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Игровые контроллеры — хронология",
  description: "Хронология устройств ввода",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="light" suppressHydrationWarning>
      <body>
        <ThemeProvider forcedTheme="light">
          <BloomRoot />
          <div className="shell">
            <Suspense fallback={<header className="top" />}>
              <SiteHeader />
            </Suspense>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
