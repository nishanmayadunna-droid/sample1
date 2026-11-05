import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORE_CONTACT,
  mailHref,
  parseContactForm,
  telHref,
  whatsappHref,
} from "./store-contact";

describe("parseContactForm", () => {
  it("accepts and normalises a valid form", () => {
    const r = parseContactForm({
      businessName: "Northbound",
      phone: "071 234 5678",
      whatsapp: "+94 71-234-5678",
      email: "hi@shop.lk",
      returnDays: "14",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.phone).toBe("0712345678");
      expect(r.value.whatsapp).toBe("+94712345678");
      expect(r.value.email).toBe("hi@shop.lk");
      expect(r.value.returnDays).toBe(14);
    }
  });

  it("defaults blank returnDays to 7 and everything else to empty", () => {
    const r = parseContactForm({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(DEFAULT_STORE_CONTACT);
    expect(DEFAULT_STORE_CONTACT.returnDays).toBe(7);
  });

  it("rejects bad values", () => {
    for (const [field, value] of [
      ["phone", "abc"],
      ["email", "nope"],
      ["returnDays", "99"],
      ["businessName", "x".repeat(81)],
    ] as const) {
      const r = parseContactForm({ [field]: value });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[field]).toBeTruthy();
    }
  });
});

describe("hrefs", () => {
  it("builds whatsapp links", () => {
    expect(whatsappHref("0712345678")).toBe("https://wa.me/94712345678");
    expect(whatsappHref("+94712345678")).toBe("https://wa.me/94712345678");
    expect(whatsappHref("")).toBeNull();
  });
  it("builds tel and mailto links", () => {
    expect(telHref("0712345678")).toBe("tel:0712345678");
    expect(telHref("")).toBeNull();
    expect(mailHref("a@b.lk")).toBe("mailto:a@b.lk");
    expect(mailHref("")).toBeNull();
  });
});
