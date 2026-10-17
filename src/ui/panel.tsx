"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card variant="outline" className={className}>
      {children}
    </Card>
  );
}
