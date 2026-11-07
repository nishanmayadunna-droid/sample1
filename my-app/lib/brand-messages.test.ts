import { describe, expect, it } from "vitest";
import { orderEmail, resetEmail, newsletterConfirmEmail, verifyEmailMessage } from "./email";
import { buildMessage, segmentCount, type MessageData, type NotificationEvent } from "./notifications";
import { buildOwnerMessage, type OwnerMessageData } from "./owner-alerts";
import { otpMessage } from "./otp";
import { customerPush, ownerPush } from "./push";

const data: MessageData = { orderNumber: "NB-10001", total: 1250000 } as MessageData;
const EVENTS: NotificationEvent[] = ["placed", "advance_due", "slip_approved", "slip_rejected", "shipped", "delivered", "cancelled"];

describe("customer SMS uses the shop's name", () => {
  it("starts with the given name in both languages for every event and never says Northbound", () => {
    for (const event of EVENTS) {
      for (const lang of ["en", "si"] as const) {
        const text = buildMessage(event, { ...data, advanceAmount: 50000, rejectReason: "blurry" } as MessageData, lang, "Kade");
        expect(text, `${event} ${lang}`).toMatch(/^Kade: /);
        expect(text).not.toContain("Northbound");
      }
    }
  });
  it("stays within 2 SMS segments with a 24-character name", () => {
    const name = "Twenty Four Chars Shop A";
    expect(name.length).toBe(24);
    for (const event of EVENTS) {
      const text = buildMessage(event, { ...data, advanceAmount: 50000, rejectReason: "x".repeat(200), trackingNumber: "AB123456", courierName: "Courier" } as MessageData, "en", name);
      expect(segmentCount(text), event).toBeLessThanOrEqual(2);
    }
  });
});

describe("one-time code", () => {
  it("names the shop", () => {
    expect(otpMessage("123456", "Kade")).toBe("Kade code: 123456. Valid 5 minutes.");
  });
});

describe("owner alerts stay printable ASCII", () => {
  const events: OwnerMessageData[] = [
    { event: "new_order", orderNumber: "NB-1", total: 100000, advanceAmount: 0 },
    { event: "new_slip", orderNumber: "NB-1" },
    { event: "low_stock", productName: "Jacket", size: "M", left: 2 },
    { event: "sms_failed", orderNumber: "NB-1", customerEvent: "placed" },
  ];
  it("uses Shop when the name is not ASCII, and the name when it is", () => {
    for (const e of events) {
      const sinhala = buildOwnerMessage(e, "කඩේ");
      expect(sinhala).toMatch(/^Shop: /);
      expect(sinhala).toMatch(/^[\x20-\x7e]+$/);
      expect(buildOwnerMessage(e, "Kade Shop")).toMatch(/^Kade Shop: /);
    }
  });
});

describe("push bodies drop the name prefix", () => {
  it("removes the given name, not a fixed one", () => {
    const customer = customerPush("placed", data, "en", "Kade");
    expect(customer.body).not.toMatch(/^Kade:/);
    expect(customer.body.length).toBeGreaterThan(5);
    const owner = ownerPush({ event: "new_slip", orderNumber: "NB-1" }, "Kade");
    expect(owner.body).not.toMatch(/^Kade:/);
  });
});

describe("emails", () => {
  const link = "https://x.test/a?token=t";
  it("name the shop in the subject and footer", () => {
    expect(resetEmail(link, "Kade").subject).toContain("Kade");
    expect(verifyEmailMessage(link, "Kade").subject).toContain("Kade");
    expect(newsletterConfirmEmail(link, "Kade").subject).toContain("Kade");
    const order = orderEmail({ orderNumber: "NB-1", en: "e", si: "s", link, event: "placed" }, "Kade");
    expect(order.subject).toContain("Kade");
    expect(order.text).toContain("Kade");
    for (const e of [resetEmail(link, "Kade"), order]) expect(e.subject + e.text + e.html).not.toContain("Northbound");
  });
  it("escapes the name in the HTML and keeps it on one line in the subject", () => {
    const order = orderEmail({ orderNumber: "NB-1", en: "e", si: "s", link, event: "placed" }, '<b>x</b> "q"\r\nBcc: a@b.c');
    expect(order.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(order.html).not.toContain("<b>x</b>");
    expect(order.subject).not.toMatch(/[\r\n]/);
  });
});
