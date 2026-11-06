const PRIVATE_PREFIXES = ["/admin", "/account", "/checkout", "/orders", "/signin"];

/** URL to report to analytics, or null when the page is private. Drops `token`. */
export function analyticsUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw, "http://localhost");
  } catch {
    return null;
  }
  const path = u.pathname;
  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  if (!u.searchParams.has("token")) return raw;
  u.searchParams.delete("token");
  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  return isAbsolute ? u.toString() : u.pathname + u.search + u.hash;
}
