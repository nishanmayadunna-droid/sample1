// Public read of the Maya chat config for the storefront shell. Cookie-less client, so pages
// stay static (ISR). Fails closed: an unreadable or switched-off config means no chat at all.
import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { bankDetailsComplete, getPaymentSettings } from "./payments-data";
import { onlinePaymentAvailable } from "./payhere-data";
import { pushAvailable } from "./push-data";
import { emailAvailable } from "./email-data";
import { getSmsSettings, smsAvailable } from "./sms-data";
import { smsTokenSet } from "./sms";
import { getNotificationSettings } from "./notifications-data";
import { getPointsSettings } from "./points-data";
import { getAllProducts } from "./catalog";
import { getRunningPromotions, getStoreSettings } from "./storefront";
import { getStoreContact } from "./store-contact-data";
import { freeShippingThreshold } from "./promotions";
import { parseChatSettings, parseTopicRow, type ChatConfig, type ChatFacts, type ChatTopic } from "./chat";
import { DEFAULT_TOPICS } from "./chat-defaults";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

/** True when a model key is set on the server. Never exposes the key. */
export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function mascotPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat-assets/${path}`;
}

const quiet = async (read: () => Promise<boolean>): Promise<boolean> => {
  try {
    return await read();
  } catch {
    return false;
  }
};

async function readTopics(): Promise<ChatTopic[]> {
  const { data, error } = await supabase.from("chat_topics").select("*").order("sort_order");
  if (error || !data) {
    if (error) console.error("chat topics unreadable", error.code ?? "unknown");
    return DEFAULT_TOPICS;
  }
  const topics = data.map(parseTopicRow).filter((t): t is ChatTopic => t !== null);
  return topics.length > 0 ? topics : DEFAULT_TOPICS;
}

/** The facts guided answers may quote. Each one is optional: a failed read just drops it. */
export async function buildFacts(): Promise<ChatFacts> {
  const [card, advance, orderSms, smsLogin, email, push, points, shop, promotions, contact, products] = await Promise.all([
    quiet(async () => (await onlinePaymentAvailable()).available),
    quiet(async () => {
      const payment = await getPaymentSettings();
      return payment.mode !== "off" && bankDetailsComplete(payment);
    }),
    // Order SMS (Part 13) is its own switch, plus the SMS token and sender id; phone sign-in (Part 9) is a different one.
    quiet(async () => {
      const [notifications, sms] = await Promise.all([getNotificationSettings(), getSmsSettings()]);
      return notifications.enabled && smsTokenSet() && sms.senderId !== "";
    }),
    quiet(smsAvailable),
    quiet(emailAvailable),
    quiet(async () => (await pushAvailable()).available),
    quiet(async () => (await getPointsSettings()).enabled),
    getStoreSettings().catch(() => null),
    getRunningPromotions().catch(() => []),
    getStoreContact().catch(() => null),
    getAllProducts().catch(() => []),
  ]);

  let ratedCount = 0;
  let ratingSum = 0;
  for (const product of products) {
    if (product.rating) {
      ratedCount += product.rating.count;
      ratingSum += product.rating.average * product.rating.count;
    }
  }

  const facts: ChatFacts = {
    features: { card, advance, sms: orderSms, smsLogin, email, push, points, notify: orderSms || email || push },
  };
  if (shop) facts.shippingFee = shop.shippingFee;
  const free = freeShippingThreshold(promotions);
  if (free !== null) facts.freeShippingFrom = free;
  if (contact) {
    if (contact.returnDays > 0) facts.returnDays = contact.returnDays;
    if (contact.phone) facts.phone = contact.phone;
    if (contact.whatsapp) facts.whatsapp = contact.whatsapp;
    if (contact.email) facts.email = contact.email;
  }
  if (ratedCount >= 5) {
    facts.reviewCount = ratedCount;
    facts.averageRating = Math.round((ratingSum / ratedCount) * 10) / 10;
  }
  return facts;
}

/** The storefront chat config, or null when the chat should not be shown at all. */
export const getChatConfig = cache(async (): Promise<ChatConfig | null> => {
  try {
    const { data, error } = await supabase.from("chat_settings").select("*").maybeSingle();
    if (error || !data) {
      if (error) console.error("chat settings unreadable", error.code ?? "unknown");
      return null;
    }
    const settings = parseChatSettings(data);
    if (!settings.enabled) return null;
    const [topics, facts] = await Promise.all([readTopics(), buildFacts()]);
    return {
      enabled: true,
      engine: settings.engine === "ai" && aiAvailable() ? "ai" : "guided",
      assistantName: settings.assistantName,
      mascotUrl: settings.mascotPath ? mascotPublicUrl(settings.mascotPath) : null,
      greeting: settings.greeting,
      firstMessage: settings.firstMessage,
      accent: settings.accent,
      showBubble: settings.showBubble,
      trust: settings.trust,
      topics,
      facts,
    };
  } catch (error) {
    console.error("chat config failed", error instanceof Error ? error.name : "unknown");
    return null;
  }
});
