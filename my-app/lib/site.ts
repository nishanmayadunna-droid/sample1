const FALLBACK = "http://localhost:3000";

/** Origin (no trailing slash) from a raw host or URL; null when it isn't usable. */
function cleanOrigin(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (v === "") return null;
  let withProtocol: string;
  if (/^https?:\/\//i.test(v)) {
    withProtocol = v;
  } else if (v.startsWith("//")) {
    withProtocol = `https:${v}`;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[^:/?#]+:\d/.test(v)) {
    return null; // some other scheme (ftp:, javascript:, http:/x) - not a host:port
  } else if (/^(localhost|127\.0\.0\.1)(:\d+)?([/?#]|$)/i.test(v)) {
    withProtocol = `http://${v}`;
  } else {
    withProtocol = `https://${v}`;
  }
  try {
    const u = new URL(withProtocol);
    if (!/^[a-z0-9.-]+$/i.test(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function resolveSiteUrl(env: {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}): string {
  return (
    cleanOrigin(env.NEXT_PUBLIC_SITE_URL) ??
    cleanOrigin(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    FALLBACK
  );
}

/** True when the resolved origin is the localhost fallback. */
export function isLocalFallback(url: string): boolean {
  return url === FALLBACK;
}

let warnedFallback = false;

export function siteUrl(): string {
  const url = resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  });
  if (!warnedFallback && isLocalFallback(url) && isProductionDeploy()) {
    warnedFallback = true;
    console.warn("site url falls back to localhost; set NEXT_PUBLIC_SITE_URL");
  }
  return url;
}

/** `path` starts with "/". */
export function absoluteUrl(path: string): string {
  return siteUrl() + path;
}

export function isProductionDeploy(
  env: { VERCEL_ENV?: string; NODE_ENV?: string } = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  },
): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}
