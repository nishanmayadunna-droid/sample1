import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildFcmMessage,
  classifyFcmError,
  customerPush,
  customerPushEvent,
  DEFAULT_PUSH_SETTINGS,
  FCM_SCOPE,
  isPushPlatform,
  isValidFcmToken,
  maskUserId,
  normalizePrivateKey,
  ownerPush,
  parsePushSettings,
  PUSH_DAILY_CAP,
  serviceAccountJwt,
  withinPushCap,
} from "./push";

describe("parsePushSettings", () => {
  it("reads every toggle and treats unticked boxes as off", () => {
    expect(parsePushSettings({})).toEqual({
      enabled: false,
      owner: { new_order: false, new_slip: false, low_stock: false, sms_failed: false },
      customer: { placed: false, shipped: false, delivered: false, cancelled: false, slip_approved: false, slip_rejected: false },
    });
    const on = parsePushSettings({ enabled: "on", owner_new_order: "on", customer_shipped: "on" });
    expect(on.enabled).toBe(true);
    expect(on.owner.new_order).toBe(true);
    expect(on.owner.new_slip).toBe(false);
    expect(on.customer.shipped).toBe(true);
    expect(on.customer.placed).toBe(false);
  });
  it("is off by default with every event ready to switch on", () => {
    expect(DEFAULT_PUSH_SETTINGS.enabled).toBe(false);
    expect(Object.values(DEFAULT_PUSH_SETTINGS.owner).every(Boolean)).toBe(true);
    expect(Object.values(DEFAULT_PUSH_SETTINGS.customer).every(Boolean)).toBe(true);
  });
});

describe("customerPushEvent", () => {
  it("maps order events and shares placed with the advance message", () => {
    expect(customerPushEvent("placed")).toBe("placed");
    expect(customerPushEvent("advance_due")).toBe("placed");
    for (const e of ["shipped", "delivered", "cancelled", "slip_approved", "slip_rejected"] as const) {
      expect(customerPushEvent(e)).toBe(e);
    }
  });
});

describe("tokens and platforms", () => {
  it("accepts a normal FCM token shape and rejects junk", () => {
    expect(isValidFcmToken("fXyZ1234567890abcdef:APA91bH-_abcdefghijklmnopqrstuvwxyz")).toBe(true);
    for (const bad of ["", "short", "has space in it 12345678901234567890", "a".repeat(4097), "<script>alert(1)</script>00000", null, undefined, 5]) {
      expect(isValidFcmToken(bad), String(bad)).toBe(false);
    }
  });
  it("knows the platforms (web now, apps later)", () => {
    for (const p of ["web", "android", "ios"]) expect(isPushPlatform(p)).toBe(true);
    for (const p of ["windows", "", null, "WEB"]) expect(isPushPlatform(p)).toBe(false);
  });
  it("masks a user id", () => {
    expect(maskUserId("1a2b3c4d-0000-4000-8000-000000000000")).toBe("u-1a2b3c4d");
  });
});

describe("messages", () => {
  it("builds the owner's push with a link into the admin", () => {
    const order = ownerPush({ event: "new_order", orderNumber: "NB-10001", total: 1250000, advanceAmount: 0 });
    expect(order.title).toBe("New order NB-10001");
    expect(order.body).not.toContain("Northbound:");
    expect(order.body).toContain("NB-10001");
    expect(order.path).toBe("/admin/orders/NB-10001");
    expect(ownerPush({ event: "new_slip", orderNumber: "NB-10001" }).path).toBe("/admin/orders/NB-10001");
    expect(ownerPush({ event: "sms_failed", orderNumber: "NB-10001", customerEvent: "shipped" }).path).toBe("/admin/notifications");
    expect(ownerPush({ event: "low_stock", productName: "Tee", size: "M", left: 2 }).path).toBe("/admin");
  });
  it("builds a customer's push in the shop language with a link to their order", () => {
    const en = customerPush("shipped", { orderNumber: "NB-10001", total: 1000, courierName: "Pronto", trackingNumber: "T123456" }, "en");
    expect(en.title).toBe("Order NB-10001");
    expect(en.body).toContain("on its way");
    expect(en.path).toBe("/orders/NB-10001");
    const si = customerPush("delivered", { orderNumber: "NB-10001", total: 1000 }, "si");
    expect(si.title).toContain("ඇණවුම");
    expect(si.body).not.toContain("Northbound:");
  });
  it("keeps a body within 180 characters", () => {
    const long = customerPush(
      "slip_rejected",
      { orderNumber: "NB-10001", total: 1000, rejectReason: "x".repeat(400) },
      "en",
    );
    expect(Array.from(long.body).length).toBeLessThanOrEqual(180);
  });
});

describe("buildFcmMessage", () => {
  const push = { title: "Order NB-1", body: "Shipped", path: "/orders/NB-1" };
  it("sends the web a data-only message with a link the worker opens", () => {
    const { message } = buildFcmMessage("web", "tok", push, "https://shop.lk/orders/NB-1");
    expect(message.token).toBe("tok");
    expect(message.data).toEqual({ title: "Order NB-1", body: "Shipped", link: "https://shop.lk/orders/NB-1" });
    expect(message.notification).toBeUndefined();
    expect(message.webpush?.headers.Urgency).toBe("high");
  });
  it("sends an app a normal notification block", () => {
    const { message } = buildFcmMessage("android", "tok", push, "https://shop.lk/orders/NB-1");
    expect(message.notification).toEqual({ title: "Order NB-1", body: "Shipped" });
    expect(message.data).toEqual({ link: "https://shop.lk/orders/NB-1" });
  });
  it("only has string data values (FCM requires it)", () => {
    for (const platform of ["web", "android", "ios"] as const) {
      const { message } = buildFcmMessage(platform, "tok", push, "https://shop.lk/x");
      expect(Object.values(message.data).every((v) => typeof v === "string")).toBe(true);
    }
  });
});

describe("classifyFcmError", () => {
  it("marks dead tokens as unregistered so they are removed", () => {
    expect(classifyFcmError(404, { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } })).toBe("unregistered");
    expect(classifyFcmError(404, null)).toBe("unregistered");
    expect(classifyFcmError(403, { error: { status: "PERMISSION_DENIED", details: [{ errorCode: "SENDER_ID_MISMATCH" }] } })).toBe("unregistered");
  });
  it("tells a rejected credential from an ordinary failure", () => {
    expect(classifyFcmError(401, { error: { status: "UNAUTHENTICATED" } })).toBe("auth");
    expect(classifyFcmError(500, { error: { status: "INTERNAL" } })).toBe("failed");
    expect(classifyFcmError(400, { error: { status: "INVALID_ARGUMENT" } })).toBe("failed");
    expect(classifyFcmError(429, undefined)).toBe("failed");
  });
});

describe("normalizePrivateKey", () => {
  it("turns an env-var key into a real PEM", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n";
    expect(normalizePrivateKey(pem.replace(/\n/g, "\\n"))).toBe(pem);
    expect(normalizePrivateKey(`"${pem.replace(/\n/g, "\\n")}"`)).toBe(pem);
    expect(normalizePrivateKey(pem)).toBe(pem.trim());
  });
});

describe("serviceAccountJwt", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const jwt = serviceAccountJwt({ clientEmail: "svc@project.iam.gserviceaccount.com", privateKey, nowSeconds: 1_800_000_000 });
  const [header, claims, signature] = jwt.split(".");
  const decode = (part: string) => JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());

  it("has the standard header and the claims Google expects", () => {
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(claims)).toEqual({
      iss: "svc@project.iam.gserviceaccount.com",
      scope: FCM_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
  });
  it("is signed with the private key (it verifies against the public key)", () => {
    const verifier = createVerify("RSA-SHA256").update(`${header}.${claims}`);
    const sig = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    expect(verifier.verify(createPublicKey(publicKey), sig)).toBe(true);
  });
  it("uses base64url with no padding or unsafe characters", () => {
    expect(jwt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

describe("daily cap", () => {
  it("allows sending only under the cap", () => {
    expect(withinPushCap(PUSH_DAILY_CAP - 1)).toBe(true);
    expect(withinPushCap(PUSH_DAILY_CAP)).toBe(false);
  });
});
