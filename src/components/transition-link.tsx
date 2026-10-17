"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { transitionPush } from "@/src/lib/navigate";

export function TransitionLink({
  href,
  className,
  style,
  viewTransitionName,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  viewTransitionName?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      style={{ ...style, viewTransitionName }}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        transitionPush(router, href);
      }}
    >
      {children}
    </a>
  );
}
