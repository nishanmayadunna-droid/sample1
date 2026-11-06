import { describe, expect, it } from "vitest";
import { analyticsUrl } from "./analytics-filter";

describe("analyticsUrl", () => {
  it("drops private pages", () => {
    for (const p of ["/admin", "/admin/orders/NB-1", "/account", "/checkout", "/orders/NB-1", "/signin?callbackUrl=/x"]) {
      expect(analyticsUrl(`https://shop.lk${p}`)).toBeNull();
    }
  });
  it("keeps public pages, including look-alikes", () => {
    expect(analyticsUrl("https://shop.lk/products/x?q=1")).toBe("https://shop.lk/products/x?q=1");
    expect(analyticsUrl("https://shop.lk/administrative")).toBe("https://shop.lk/administrative");
  });
  it("strips the token parameter", () => {
    expect(analyticsUrl("https://shop.lk/unsubscribe?token=abc&a=1")).toBe("https://shop.lk/unsubscribe?a=1");
    expect(analyticsUrl("https://shop.lk/unsubscribe?token=abc")).toBe("https://shop.lk/unsubscribe");
  });
});
