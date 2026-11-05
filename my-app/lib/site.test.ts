import { describe, expect, it } from "vitest";
import { isProductionDeploy, resolveSiteUrl } from "./site";

describe("resolveSiteUrl", () => {
  it("strips a trailing slash", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://shop.lk/" })).toBe("https://shop.lk");
  });
  it("adds https when the protocol is missing", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "shop.lk" })).toBe("https://shop.lk");
  });
  it("drops path, query and hash", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://shop.lk/path?x=1" })).toBe("https://shop.lk");
  });
  it("falls through an invalid value to the Vercel production URL", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "not a url",
        VERCEL_PROJECT_PRODUCTION_URL: "sample1-azure.vercel.app",
      }),
    ).toBe("https://sample1-azure.vercel.app");
  });
  it("defaults to localhost", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
  it("keeps an explicit http localhost", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
  });
});

describe("isProductionDeploy", () => {
  it("is true for VERCEL_ENV production", () => {
    expect(isProductionDeploy({ VERCEL_ENV: "production" })).toBe(true);
  });
  it("is false for a preview build", () => {
    expect(isProductionDeploy({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe(false);
  });
  it("uses NODE_ENV when VERCEL_ENV is unset", () => {
    expect(isProductionDeploy({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionDeploy({ NODE_ENV: "development" })).toBe(false);
  });
});

describe("resolveSiteUrl edge cases", () => {
  const L = "http://localhost:3000";
  const r = (a?: string, b?: string) =>
    resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: a, VERCEL_PROJECT_PRODUCTION_URL: b });
  it("falls through blank values", () => {
    expect(r("   ", "v.app")).toBe("https://v.app");
    expect(r("", undefined)).toBe(L);
  });
  it("uses localhost when both are invalid", () => {
    expect(r("not a url", "also bad")).toBe(L);
  });
  it("cleans the Vercel value", () => {
    expect(r(undefined, "https://v.app/x?y=1")).toBe("https://v.app");
  });
  it("handles protocol-relative, case and ports", () => {
    expect(r("//shop.lk")).toBe("https://shop.lk");
    expect(r("HTTPS://Shop.LK")).toBe("https://shop.lk");
    expect(r("shop.lk:8080/path")).toBe("https://shop.lk:8080");
  });
  it("rejects non-http schemes and malformed ones", () => {
    expect(r("javascript:alert(1)")).toBe(L);
    expect(r("data:text/html,x")).toBe(L);
    expect(r("ftp://shop.lk")).toBe(L);
    expect(r("http:/shop.lk")).toBe(L);
  });
  it("uses http for protocol-less local hosts", () => {
    expect(r("localhost:3000")).toBe("http://localhost:3000");
    expect(r("localhost")).toBe("http://localhost");
    expect(r("127.0.0.1:4000")).toBe("http://127.0.0.1:4000");
  });
});
