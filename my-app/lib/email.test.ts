import { describe, expect, it } from "vitest";
import {
  clientIp,
  EMAIL_DAILY_CAP,
  escapeHtml,
  generateToken,
  hashToken,
  isDeliverableEmail,
  isTokenShape,
  isValidFrom,
  maskEmail,
  newsletterConfirmEmail,
  orderEmail,
  parseEmailSettings,
  resetEmail,
  tokenLink,
  verifyEmailMessage,
  withinEmailCap,
} from "./email";

describe("tokens", () => {
  it("are 64 hex characters and never repeat", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(isTokenShape(a)).toBe(true);
  });
  it("hash to a stable value that is not the token", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(generateToken())).not.toBe(hashToken(token));
  });
  it("are checked for shape before they touch the database", () => {
    for (const bad of ["", "abc", "g".repeat(64), "A".repeat(64), `${"a".repeat(63)}`, `${"a".repeat(65)}`, null, undefined, 5]) {
      expect(isTokenShape(bad)).toBe(false);
    }
  });
});

describe("addresses", () => {
  it("accepts a plain address and refuses header tricks or two recipients", () => {
    expect(isDeliverableEmail("nimal@gmail.com")).toBe(true);
    for (const bad of ["a@b", "a b@c.lk", "a@b.lk,c@d.lk", "a@b.lk;c@d.lk", "a@b.lk\nBcc: x@y.lk", "<a@b.lk>", "", null, undefined]) {
      expect(isDeliverableEmail(bad as string), String(bad)).toBe(false);
    }
    expect(isDeliverableEmail(`${"a".repeat(250)}@b.lk`)).toBe(false);
  });
  it("masks all but the first letter and the domain", () => {
    expect(maskEmail("nimal@gmail.com")).toBe("n***@gmail.com");
    expect(maskEmail("nonsense")).toBe("***");
    expect(maskEmail("x".repeat(300) + "@a.lk").length).toBeLessThanOrEqual(120);
  });
  it("checks the sender", () => {
    expect(isValidFrom("orders@shop.lk")).toBe(true);
    expect(isValidFrom("Northbound <orders@shop.lk>")).toBe(true);
    for (const bad of ["", "orders", "a@b.lk, c@d.lk", "Name <a@b.lk>\nBcc: x@y.lk", "<>", "x".repeat(250) + "@b.lk"]) {
      expect(isValidFrom(bad), bad).toBe(false);
    }
  });
});

describe("clientIp", () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;
  it("takes the first forwarded address", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });
  it("is unknown when missing or not an address", () => {
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "x".repeat(100) }))).toBe("unknown");
  });
});

describe("tokenLink", () => {
  it("builds the link on the right path and encodes the token", () => {
    expect(tokenLink("https://shop.lk/", "reset", "abc")).toBe("https://shop.lk/reset-password?token=abc");
    expect(tokenLink("https://shop.lk", "verify", "abc")).toBe("https://shop.lk/verify-email?token=abc");
    expect(tokenLink("https://shop.lk", "newsletter", "a b")).toBe("https://shop.lk/newsletter/confirm?token=a%20b");
  });
});

describe("templates", () => {
  const link = "https://shop.lk/reset-password?token=" + "a".repeat(64);
  it("are bilingual and carry the link in both text and html", () => {
    for (const email of [resetEmail(link), verifyEmailMessage(link), newsletterConfirmEmail(link)]) {
      expect(email.subject).toContain("|");
      expect(email.text).toContain(link);
      expect(email.html).toContain(link);
      expect(email.html).toContain("<a href=");
      expect(email.text).toContain("---");
    }
  });
  it("say how long the link works", () => {
    expect(resetEmail(link).text).toContain("1 hour");
    expect(verifyEmailMessage(link).text).toContain("48 hours");
  });
  it("escape what goes into the html", () => {
    const email = orderEmail({
      orderNumber: "NB-10001",
      en: '<script>alert("x")</script>',
      si: "a & b",
      link: 'https://shop.lk/o?x="1"&y=2',
      event: "shipped",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("a &amp; b");
    expect(email.html).toContain("&quot;1&quot;");
  });
  it("order emails name the order and the event", () => {
    const email = orderEmail({ orderNumber: "NB-10001", en: "Shipped.", si: "යවා ඇත.", link, event: "shipped" });
    expect(email.subject).toContain("NB-10001");
    expect(email.subject).toContain("on its way");
    expect(orderEmail({ orderNumber: "NB-1", en: "x", si: "y", link, event: "mystery" }).subject).toContain("update");
  });
  it("escapeHtml handles the five special characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});

describe("settings and caps", () => {
  it("parses the admin form", () => {
    expect(parseEmailSettings({ enabled: "on", orderEmails: "on" })).toEqual({ enabled: true, orderEmails: true });
    expect(parseEmailSettings({})).toEqual({ enabled: false, orderEmails: false });
  });
  it("allows sending only under the daily cap", () => {
    expect(withinEmailCap(EMAIL_DAILY_CAP - 1)).toBe(true);
    expect(withinEmailCap(EMAIL_DAILY_CAP)).toBe(false);
  });
});
