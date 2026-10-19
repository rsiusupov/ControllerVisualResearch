/**
 * Site prefix for a GitHub Pages project site (`/ControllerVisualResearch`).
 * Empty during `next dev`, so local links and images stay at `/`.
 * Inlined from `next.config.ts` when `PAGES=1` or `GITHUB_ACTIONS` is set.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative path (`/images/...`, `/games/`) when a base path is set. */
export function withBasePath(path: string) {
  if (!basePath || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}
