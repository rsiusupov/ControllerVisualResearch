"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/ui/button";
import { Icon } from "@/src/ui/icon";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  labelledBy,
  restoreFocus,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  restoreFocus: HTMLElement | null;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreRef = useRef<HTMLElement | null>(null);
  const backdropReady = useRef(false);
  onCloseRef.current = onClose;
  if (restoreFocus) restoreRef.current = restoreFocus;

  useEffect(() => {
    if (!open) return;
    const back = restoreRef.current;
    const frame = frameRef.current;
    const panel = panelRef.current;
    backdropReady.current = false;
    panel?.focus({ preventScroll: true });

    const focusable = () =>
      frame
        ? Array.from(frame.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (node) => !node.hasAttribute("disabled"),
          )
        : [];

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !frame) return;
      const nodes = focusable();
      if (!nodes.length) {
        event.preventDefault();
        panel?.focus({ preventScroll: true });
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && frame.contains(current);
      if (!inside || current === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey) {
        if (current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const arm = window.setTimeout(() => {
      backdropReady.current = true;
    }, 0);

    return () => {
      window.clearTimeout(arm);
      backdropReady.current = false;
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="record-overlay">
      <div
        className="record-backdrop"
        onClick={() => {
          if (!backdropReady.current) return;
          onCloseRef.current();
        }}
      />
      <div ref={frameRef} className="record-dialog-frame">
        <div
          ref={panelRef}
          className="record-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          tabIndex={-1}
        >
          <div className="record-dialog-body">{children}</div>
        </div>
        <Button
          type="button"
          className="record-dialog-close"
          variant="outline"
          size="sm"
          iconOnly
          tooltip={false}
          aria-label="Закрыть"
          onClick={() => onCloseRef.current()}
        >
          <Icon name="close" />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
