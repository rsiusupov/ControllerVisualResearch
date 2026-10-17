"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizePath, notifyRoute, transitionPush } from "@/src/lib/navigate";
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

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    notifyRoute(pathname);
  }, [pathname, searchParams]);

  return (
    <header className="top">
      {home ? (
        <p className="kicker">BLABLALABS</p>
      ) : (
        <TransitionLink href="/" className="wordmark" viewTransitionName="site-title">
          Игровые контроллеры
        </TransitionLink>
      )}
      <form
        className="search-form"
        style={{ viewTransitionName: "site-search" }}
        action="/search/"
        onSubmit={(event) => {
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
        }}
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
        />
        <Button type="submit" variant="primary">
          Найти
        </Button>
      </form>
    </header>
  );
}
