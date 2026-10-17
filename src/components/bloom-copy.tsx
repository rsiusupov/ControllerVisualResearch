"use client";

import { useLayoutEffect, useRef } from "react";

export function BloomCopy({ parts }: { parts: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = parts.join("\0");

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.replaceChildren();
    for (const part of parts) {
      if (!part.trim()) continue;
      const paragraph = document.createElement("p");
      paragraph.textContent = part;
      node.appendChild(paragraph);
    }
  }, [key]);

  if (!parts.some((part) => part.trim())) return null;
  return <div ref={ref} className="copy" />;
}
