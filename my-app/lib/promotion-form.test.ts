import { describe, expect, it } from "vitest";
import {
  colomboToUtcIso,
  MAX_RULES,
  parsePromotionForm,
  parseRule,
  utcIsoToColombo,
} from "./promotion-form";

describe("Colombo time", () => {
  it("converts a local time to UTC across the day boundary", () => {
    expect(colomboToUtcIso("2026-10-31T23:59")).toBe("2026-10-31T18:29:00.000Z");
    expect(colomboToUtcIso("2026-11-01T00:00")).toBe("2026-10-31T18:30:00.000Z");
  });

  it("round-trips", () => {
    expect(utcIsoToColombo(colomboToUtcIso("2026-10-31T23:59")!)).toBe("2026-10-31T23:59");
  });

  it("rejects malformed input", () => {
    for (const value of ["", "2026-13-01T00:00", "tomorrow", "2026-10-31"]) {
      expect(colomboToUtcIso(value), value).toBeNull();
    }
  });
});

describe("parseRule", () => {
  it("reads a percent rule on categories with a minimum in rupees", () => {
    expect(
      parseRule({ kind: "percent_off", value: "20", scope: "categories", categorySlugs: ["tops"], productIds: [], min: "10000" }),
    ).toEqual({
      ok: true,
      value: {
        kind: "percent_off",
        value: 20,
        scope: "categories",
        category_slugs: ["tops"],
        product_ids: [],
        min_subtotal: 1000000,
      },
    });
  });

  it("reads rupee amounts as cents and free shipping as 0", () => {
    const amount = parseRule({ kind: "amount_off_order", value: "500", scope: "all", min: "" });
    expect(amount.ok && amount.value.value).toBe(50000);
    const ship = parseRule({ kind: "free_shipping", value: "", scope: "all", min: "5000" });
    expect(ship.ok && [ship.value.value, ship.value.min_subtotal]).toEqual([0, 500000]);
  });

  it("rejects bad percentages, amounts, kinds and empty scopes", () => {
    const bad = [
      { kind: "percent_off", value: "0", scope: "all" },
      { kind: "percent_off", value: "91", scope: "all" },
      { kind: "amount_off_item", value: "0", scope: "all" },
      { kind: "amount_off_item", value: "1000001", scope: "all" },
      { kind: "bogus", value: "1", scope: "all" },
      { kind: "percent_off", value: "10", scope: "categories", categorySlugs: [] },
      { kind: "percent_off", value: "10", scope: "products", productIds: [] },
      { kind: "percent_off", value: "10", scope: "all", min: "-5" },
      null,
    ];
    for (const raw of bad) expect(parseRule(raw).ok, JSON.stringify(raw)).toBe(false);
  });
});

describe("parsePromotionForm", () => {
  const rules = JSON.stringify([{ kind: "percent_off", value: "20", scope: "all", min: "" }]);
  const ok = {
    slug: "halloween",
    nameSi: "හැලොවීන්",
    nameEn: "Halloween",
    startsAt: "2026-10-25T00:00",
    endsAt: "2026-10-31T23:59",
    active: "on",
    sortOrder: "1",
    bannerMode: "template",
    headlineEn: "Spooky sale",
    colorFrom: "#cb4a1c",
    colorTo: "#15231d",
    textColor: "#ffffff",
    rules,
  };

  it("parses a full form", () => {
    const r = parsePromotionForm(ok, "create");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.slug).toBe("halloween");
    expect(r.value).toMatchObject({
      name_en: "Halloween",
      starts_at: "2026-10-24T18:30:00.000Z",
      ends_at: "2026-10-31T18:29:00.000Z",
      active: true,
      banner_mode: "template",
      headline_en: "Spooky sale",
    });
    expect(r.rules).toHaveLength(1);
  });

  it("needs a name in one language and a valid slug on create", () => {
    const r = parsePromotionForm({ ...ok, nameSi: " ", nameEn: "", slug: "Bad Slug" }, "create");
    expect(!r.ok && [!!r.errors.name, !!r.errors.slug]).toEqual([true, true]);
  });

  it("ignores the slug on update", () => {
    const r = parsePromotionForm({ ...ok, slug: undefined }, "update");
    expect(r.ok && r.slug).toBeUndefined();
  });

  it("needs a start, and an end after it", () => {
    expect(parsePromotionForm({ ...ok, startsAt: "" }, "create").ok).toBe(false);
    const r = parsePromotionForm({ ...ok, endsAt: "2026-10-20T00:00" }, "create");
    expect(!r.ok && r.errors.endsAt).toBeTruthy();
    expect(parsePromotionForm({ ...ok, endsAt: "" }, "create")).toMatchObject({ ok: true, value: { ends_at: null } });
  });

  it("checks the banner", () => {
    const noHeadline = parsePromotionForm({ ...ok, headlineEn: "", headlineSi: "" }, "create");
    expect(!noHeadline.ok && noHeadline.errors.banner).toBeTruthy();
    const noImage = parsePromotionForm({ ...ok, bannerMode: "image" }, "create");
    expect(!noImage.ok && noImage.errors.banner).toBeTruthy();
    expect(parsePromotionForm({ ...ok, bannerMode: "image", imagePath: "x.jpg" }, "create").ok).toBe(true);
    expect(parsePromotionForm({ ...ok, bannerMode: "image", hasImage: "1" }, "update").ok).toBe(true);
    const badColor = parsePromotionForm({ ...ok, colorFrom: "red" }, "create");
    expect(!badColor.ok && badColor.errors.banner).toBeTruthy();
  });

  it("reports rule errors by position and limits the count", () => {
    const badRule = parsePromotionForm({ ...ok, rules: JSON.stringify([{ kind: "percent_off", value: "99", scope: "all" }]) }, "create");
    expect(!badRule.ok && badRule.errors.rules).toMatch(/Rule 1/);
    const tooMany = JSON.stringify(Array.from({ length: MAX_RULES + 1 }, () => ({ kind: "free_shipping", scope: "all" })));
    expect(parsePromotionForm({ ...ok, rules: tooMany }, "create").ok).toBe(false);
    expect(parsePromotionForm({ ...ok, rules: "not json" }, "create").ok).toBe(false);
  });
});
