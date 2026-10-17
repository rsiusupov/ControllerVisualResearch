type Waiter = { path: string; finish: () => void };

let waiter: Waiter | null = null;

export function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

export function notifyRoute(pathname: string) {
  if (!waiter) return;
  if (normalizePath(pathname) !== normalizePath(waiter.path)) return;
  const finish = waiter.finish;
  waiter = null;
  finish();
}

export function transitionPush(router: { push: (href: string) => void }, href: string) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const go = () => router.push(href);
  if (reduced || typeof document.startViewTransition !== "function") {
    go();
    return;
  }
  const url = new URL(href, window.location.origin);
  let settled = false;
  const ready = new Promise<void>((resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      if (waiter?.finish === finish) waiter = null;
      resolve();
    };
    waiter = { path: url.pathname, finish };
    window.setTimeout(finish, 1000);
  });
  document.startViewTransition(() => {
    go();
    return ready;
  });
}
