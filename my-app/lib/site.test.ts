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
