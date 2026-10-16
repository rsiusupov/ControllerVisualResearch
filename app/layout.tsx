import type { Metadata } from "next";
import { BloomRoot } from "@/src/components/bloom-root";
import "./globals.css";

export const metadata: Metadata = {
  title: "Игровые контроллеры — хронология",
  description: "Хронология устройств ввода",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <BloomRoot />
        {children}
      </body>
    </html>
  );
}
