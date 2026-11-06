import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCheckoutForm,
  canPayOnline,
  checkoutHash,
  CHECKOUT_URL,
  FALLBACK_EMAIL,
  formatAmount,
  notifySignature,
  onlineAmounts,
  outcomeForCode,
  parseAmountToCents,
  parseNotify,
  parsePayhereSettings,
  splitName,
  verifyNotify,
  giftText,
} from "./payhere";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const MERCHANT = "1211149";
const SECRET = "test-secret-value";

describe("formatAmount / parseAmountToCents", () => {
  it("formats two decimals with no thousands separator", () => {
    expect(formatAmount(100000)).toBe("1000.00");
    expect(formatAmount(123450)).toBe("1234.50");
    expect(formatAmount(5)).toBe("0.05");
    expect(formatAmount(1234567890)).toBe("12345678.90");
  });
  it("parses what PayHere sends back", () => {
    expect(parseAmountToCents("1000.00")).toBe(100000);
    expect(parseAmountToCents("1234.5")).toBe(123450);
    expect(parseAmountToCents("10")).toBe(1000);
  });
  it("rejects junk, zero and negatives", () => {
    for (const bad of ["", "0", "0.00", "-5", "1,000.00", "1.234", "abc", "1e3", " "]) {
      expect(parseAmountToCents(bad), bad).toBeNull();
    }
  });
  it("round-trips", () => {
    for (const cents of [1, 99, 100, 12345, 99999999]) expect(parseAmountToCents(formatAmount(cents))).toBe(cents);
  });
});

describe("checkoutHash", () => {
  it("follows PayHere's documented formula", () => {
    const expected = md5(MERCHANT + "NB-10001-ab12cd" + "1250.00" + "LKR" + md5(SECRET).toUpperCase()).toUpperCase();
    expect(checkoutHash(MERCHANT, "NB-10001-ab12cd", "1250.00", "LKR", SECRET)).toBe(expected);
  });
  it("is uppercase hex and changes with every input", () => {
    const base = checkoutHash(MERCHANT, "A", "10.00", "LKR", SECRET);
    expect(base).toMatch(/^[0-9A-F]{32}$/);
    expect(checkoutHash(MERCHANT, "B", "10.00", "LKR", SECRET)).not.toBe(base);
    expect(checkoutHash(MERCHANT, "A", "10.01", "LKR", SECRET)).not.toBe(base);
    expect(checkoutHash(MERCHANT, "A", "10.00", "USD", SECRET)).not.toBe(base);
    expect(checkoutHash(MERCHANT, "A", "10.00", "LKR", SECRET + "x")).not.toBe(base);
  });
});

describe("notify verification", () => {
  const fields = { merchantId: MERCHANT, orderId: "NB-10001-ab12cd", amount: "1250.00", currency: "LKR", statusCode: "2" };
  const signed = (over: Partial<typeof fields> = {}) => {
    const f = { ...fields, ...over };
    return { ...f, paymentId: "320032", method: "VISA", md5sig: notifySignature(f, SECRET) };
  };

  it("matches the documented md5sig formula", () => {
    const expected = md5(MERCHANT + "NB-10001-ab12cd" + "1250.00" + "LKR" + "2" + md5(SECRET).toUpperCase()).toUpperCase();
    expect(notifySignature(fields, SECRET)).toBe(expected);
  });
  it("accepts a correctly signed notification (any letter case)", () => {
    expect(verifyNotify(signed(), MERCHANT, SECRET)).toBe(true);
    expect(verifyNotify({ ...signed(), md5sig: signed().md5sig.toLowerCase() }, MERCHANT, SECRET)).toBe(true);
  });
  it("rejects a wrong secret, a tampered amount, status or order, or another merchant", () => {
    expect(verifyNotify(signed(), MERCHANT, "other-secret")).toBe(false);
    expect(verifyNotify({ ...signed(), amount: "1.00" }, MERCHANT, SECRET)).toBe(false);
    expect(verifyNotify({ ...signed(), statusCode: "-2" }, MERCHANT, SECRET)).toBe(false);
    expect(verifyNotify({ ...signed(), orderId: "NB-10002-ab12cd" }, MERCHANT, SECRET)).toBe(false);
    expect(verifyNotify(signed(), "999", SECRET)).toBe(false);
    expect(verifyNotify({ ...signed(), md5sig: "" }, MERCHANT, SECRET)).toBe(false);
    expect(verifyNotify({ ...signed(), md5sig: "short" }, MERCHANT, SECRET)).toBe(false);
  });
});

describe("parseNotify", () => {
  const body: Record<string, string> = {
    merchant_id: MERCHANT,
    order_id: "NB-10001-ab12cd",
    payment_id: "320032",
    payhere_amount: "1250.00",
    payhere_currency: "LKR",
    status_code: "2",
    md5sig: "ABC",
    method: "VISA",
  };
  const get = (b: Record<string, string>) => (name: string) => (name in b ? b[name] : null);

  it("reads the callback fields", () => {
    expect(parseNotify(get(body))).toMatchObject({ orderId: "NB-10001-ab12cd", amount: "1250.00", statusCode: "2", method: "VISA" });
  });
  it("is null when a required field is missing, empty or oversized", () => {
    for (const name of ["merchant_id", "order_id", "payhere_amount", "payhere_currency", "status_code", "md5sig"]) {
      const { [name]: _removed, ...rest } = body;
      void _removed;
      expect(parseNotify(get(rest)), name).toBeNull();
      expect(parseNotify(get({ ...body, [name]: "" })), name).toBeNull();
    }
    expect(parseNotify(get({ ...body, order_id: "x".repeat(51) }))).toBeNull();
  });
  it("tolerates missing optional fields", () => {
    const { payment_id: _p, method: _m, ...rest } = body;
    void _p;
    void _m;
    expect(parseNotify(get(rest))).toMatchObject({ paymentId: "", method: "" });
  });
});

describe("outcomeForCode", () => {
  it("maps PayHere's status codes", () => {
    expect(outcomeForCode("2")).toBe("success");
    expect(outcomeForCode("0")).toBe("pending");
    expect(outcomeForCode("-1")).toBe("cancelled");
    expect(outcomeForCode("-2")).toBe("failed");
    expect(outcomeForCode("-3")).toBe("chargedback");
    expect(outcomeForCode("7")).toBe("unknown");
    expect(outcomeForCode("")).toBe("unknown");
  });
});

describe("canPayOnline", () => {
  it("allows open, unpaid and advance-pending orders", () => {
    for (const status of ["pending", "confirmed"] as const) {
      for (const paymentStatus of ["unpaid", "advance_due"] as const) {
        expect(canPayOnline({ status, paymentStatus })).toBe(true);
      }
    }
  });
  it("refuses while a bank slip is under review (the transfer would be lost)", () => {
    expect(canPayOnline({ status: "pending", paymentStatus: "slip_uploaded" })).toBe(false);
    expect(canPayOnline({ status: "confirmed", paymentStatus: "slip_uploaded" })).toBe(false);
  });
  it("refuses paid, shipped, delivered and cancelled orders", () => {
    expect(canPayOnline({ status: "pending", paymentStatus: "advance_paid" })).toBe(false);
    expect(canPayOnline({ status: "pending", paymentStatus: "online_paid" })).toBe(false);
    for (const status of ["shipped", "delivered", "cancelled"] as const) {
      expect(canPayOnline({ status, paymentStatus: "unpaid" })).toBe(false);
    }
  });
});

describe("onlineAmounts", () => {
  const order = { subtotal: 1_000_000, discount: 100_000, pointsDiscount: 50_000, total: 835_000 };
  it("takes the percent off the goods only, never shipping", () => {
    // goods = 10000 - 1000 - 500 = Rs 8,500; 5% = Rs 425
    expect(onlineAmounts(order, { discountPercent: 5 })).toEqual({ discount: 42_500, payable: 792_500 });
  });
  it("is no discount at 0 percent", () => {
    expect(onlineAmounts(order, { discountPercent: 0 })).toEqual({ discount: 0, payable: 835_000 });
  });
  it("rounds the discount down", () => {
    expect(onlineAmounts({ subtotal: 999, discount: 0, pointsDiscount: 0, total: 1999 }, { discountPercent: 10 }).discount).toBe(99);
  });
  it("always leaves at least Re 1 to charge", () => {
    const result = onlineAmounts({ subtotal: 10_000, discount: 0, pointsDiscount: 0, total: 10_050 }, { discountPercent: 50 });
    expect(result.payable).toBeGreaterThanOrEqual(100);
    const tiny = onlineAmounts({ subtotal: 50, discount: 0, pointsDiscount: 0, total: 50 }, { discountPercent: 50 });
    expect(tiny.discount).toBe(0);
    expect(tiny.payable).toBe(50);
  });
  it("ignores a negative percent", () => {
    expect(onlineAmounts(order, { discountPercent: -10 }).discount).toBe(0);
  });
});

describe("splitName", () => {
  it("splits first and last, and fills a missing last name", () => {
    expect(splitName("Nimal Perera")).toEqual({ first: "Nimal", last: "Perera" });
    expect(splitName("  Nimal  de  Silva ")).toEqual({ first: "Nimal", last: "de Silva" });
    expect(splitName("Nimal")).toEqual({ first: "Nimal", last: "Customer" });
    expect(splitName("")).toEqual({ first: "Customer", last: "Customer" });
  });
});

describe("buildCheckoutForm", () => {
  const input = {
    merchantId: MERCHANT,
    secret: SECRET,
    sandbox: true,
    ref: "NB-10001-ab12cd",
    amountCents: 125000,
    orderNumber: "NB-10001",
    customerName: "Nimal Perera",
    email: null,
    phone: "0771234567",
    address: "12 Lake Road",
    city: "Kandy",
    returnUrl: "https://shop.example/orders/NB-10001",
    cancelUrl: "https://shop.example/orders/NB-10001",
    notifyUrl: "https://shop.example/api/payhere/notify",
  };

  it("posts to the sandbox or live checkout and signs the amount it sends", () => {
    const sandbox = buildCheckoutForm(input);
    expect(sandbox.url).toBe(CHECKOUT_URL.sandbox);
    expect(buildCheckoutForm({ ...input, sandbox: false }).url).toBe(CHECKOUT_URL.live);
    expect(CHECKOUT_URL.live).toContain("://www.");
    expect(sandbox.fields.amount).toBe("1250.00");
    expect(sandbox.fields.hash).toBe(checkoutHash(MERCHANT, "NB-10001-ab12cd", "1250.00", "LKR", SECRET));
  });
  it("includes every required PayHere field", () => {
    const { fields } = buildCheckoutForm(input);
    for (const name of [
      "merchant_id", "return_url", "cancel_url", "notify_url", "first_name", "last_name", "email",
      "phone", "address", "city", "country", "order_id", "items", "currency", "amount", "hash",
    ]) {
      expect(fields[name], name).toBeTruthy();
    }
    expect(fields.order_id).toBe("NB-10001-ab12cd");
    expect(fields.currency).toBe("LKR");
  });
  it("never puts the secret in the form", () => {
    const { fields } = buildCheckoutForm(input);
    expect(JSON.stringify(fields)).not.toContain(SECRET);
  });
  it("uses a placeholder email for phone-only accounts and the real one otherwise", () => {
    expect(buildCheckoutForm(input).fields.email).toBe(FALLBACK_EMAIL);
    expect(buildCheckoutForm({ ...input, email: "a@b.lk" }).fields.email).toBe("a@b.lk");
  });
});

describe("parsePayhereSettings", () => {
  it("accepts a valid form", () => {
    expect(parsePayhereSettings({ enabled: "on", sandbox: "on", discountPercent: "5", giftSi: "", giftEn: "Free tote" })).toEqual({
      ok: true,
      value: { enabled: true, sandbox: true, discountPercent: 5, giftSi: "", giftEn: "Free tote" },
    });
  });
  it("treats unticked boxes as off", () => {
    expect(parsePayhereSettings({ discountPercent: "0" })).toMatchObject({ ok: true, value: { enabled: false, sandbox: false } });
  });
  it("rejects a bad percent or an over-long / control-character gift", () => {
    for (const discountPercent of ["", "51", "-1", "2.5", "abc", "100"]) {
      expect(parsePayhereSettings({ discountPercent }).ok, discountPercent).toBe(false);
    }
    expect(parsePayhereSettings({ discountPercent: "5", giftEn: "x".repeat(121) }).ok).toBe(false);
    expect(parsePayhereSettings({ discountPercent: "5", giftSi: "a\u0000b" }).ok).toBe(false);
  });
});

describe("giftText", () => {
  it("prefers the visitor's language and falls back to the other", () => {
    expect(giftText({ giftSi: "දීමනාව", giftEn: "Gift" }, "si")).toBe("දීමනාව");
    expect(giftText({ giftSi: "", giftEn: "Gift" }, "si")).toBe("Gift");
    expect(giftText({ giftSi: "", giftEn: "" }, "en")).toBeNull();
    expect(giftText({ giftSi: " ", giftEn: " " }, "en")).toBeNull();
  });
});
