import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

function repositoryName() {
  const fromActions = process.env.GITHUB_REPOSITORY?.split("/").pop();
  if (fromActions) return fromActions;
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return url.split("/").pop()?.replace(/\.git$/, "") ?? "";
  } catch {
    return "";
  }
}

/**
 * Project Pages sites are served from https://<user>.github.io/<repo>/.
 * A user site (`*.github.io`) stays at the domain root.
 * `next dev` does not set PAGES or GITHUB_ACTIONS, so the local app stays at `/`.
 */
function pagesBasePath() {
  const enabled = process.env.PAGES === "1" || process.env.GITHUB_ACTIONS === "true";
  if (!enabled) return "";
  const repo = repositoryName();
  if (!repo || repo.endsWith(".github.io")) return "";
  return `/${repo}`;
}

const basePath = pagesBasePath();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
