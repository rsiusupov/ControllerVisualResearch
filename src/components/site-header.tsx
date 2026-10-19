"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { normalizePath, notifyRoute, transitionPush } from "@/src/lib/navigate";
import { InputSuffixButton } from "@/components/ui/input/input";
import { Button } from "@/src/ui/button";
import { Icon } from "@/src/ui/icon";
import { TextField } from "@/src/ui/text-field";
import { TransitionLink } from "@/src/components/transition-link";

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const home = normalizePath(pathname) === "/";
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreToggleFocus = useRef(false);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    notifyRoute(pathname);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (open) {
      document.getElementById("site-q")?.focus({ preventScroll: true });
      return;
    }
    if (!restoreToggleFocus.current) return;
    restoreToggleFocus.current = false;
    toggleRef.current?.focus({ preventScroll: true });
  }, [open]);

  function collapse(restoreFocus = false) {
    if (home) return;
    if (restoreFocus) restoreToggleFocus.current = true;
    setOpen(false);
  }

  function clearQuery() {
    setQuery("");
    document.getElementById("site-q")?.focus({ preventScroll: true });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const next = query.trim();
    if (next) params.set("q", next);
    else params.delete("q");
    if (normalizePath(pathname) !== "/search") {
      params.forEach((_, key) => {
        if (key !== "q") params.delete(key);
      });
    }
    const suffix = params.toString();
    transitionPush(router, suffix ? `/search/?${suffix}` : "/search/");
  }

  function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    collapse(true);
  }

  function onFormPointerDown(event: PointerEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("button[type='submit']")) return;
    // Keep the field focused so the click can submit before an empty blur collapses the form.
    event.preventDefault();
  }

  function onFormBlur(event: FocusEvent<HTMLFormElement>) {
    if (query.trim()) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    collapse();
  }

  function onFormClick(event: MouseEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-slot='input-prefix']")) return;
    if (query.trim()) return;
    collapse();
  }

  const form = (
    <form
      className="search-form"
      style={{ viewTransitionName: "site-search" }}
      action="/search/"
      onSubmit={onSubmit}
      onKeyDown={onFormKeyDown}
      onPointerDown={onFormPointerDown}
      onBlur={onFormBlur}
      onClick={onFormClick}
    >
      <TextField
        id="site-q"
        name="q"
        label="Поиск"
        hiddenLabel
        icon={<Icon name="search" />}
        value={query}
        placeholder="Поиск по каталогу"
        onChange={(event) => setQuery(event.target.value)}
        suffix={
          query ? (
            <InputSuffixButton
              aria-label="Очистить"
              onPointerDown={(event) => event.preventDefault()}
              onClick={clearQuery}
            >
              <Icon name="close" />
            </InputSuffixButton>
          ) : null
        }
      />
      <Button type="submit" variant="primary">
        Найти
      </Button>
    </form>
  );

  const toggle = (
    <Button
      ref={toggleRef}
      type="button"
      variant="ghost"
      iconOnly
      tooltip={false}
      className="search-toggle"
      style={{ viewTransitionName: "site-search" }}
      aria-label="Поиск"
      aria-expanded={false}
      onClick={() => setOpen(true)}
    >
      <Icon name="search" />
    </Button>
  );

  if (home) {
    return <div className="home-search">{form}</div>;
  }

  return (
    <header className={open ? "top" : "top is-search-collapsed"}>
      <TransitionLink href="/" className="wordmark">
        BLA BLA LABS
      </TransitionLink>
      {open ? form : toggle}
    </header>
  );
}
