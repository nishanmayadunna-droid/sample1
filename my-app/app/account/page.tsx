import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { statusLabel } from "@/lib/orders";
import { listOrdersForUser } from "@/lib/orders-data";
import { isUserTrusted } from "@/lib/payments-data";
import { ledgerKindLabel } from "@/lib/points";
import { getPointsBalance, getPointsSettings, listLedgerForUser } from "@/lib/points-data";
import { formatPrice } from "@/lib/products";
import { expiryPicture, nextTier } from "@/lib/points-v2";
import { getExpiryDays, getLedgerForExpiry, getLoyaltyStanding } from "@/lib/points-v2-data";
import { emailAvailable } from "@/lib/email-data";
import { pushAvailable } from "@/lib/push-data";
import { maskUserId } from "@/lib/push";
import { smsAvailable } from "@/lib/sms-data";
import { isEmailVerified } from "@/lib/users";
import PhoneSection from "./PhoneSection";
import PushToggle from "../components/PushToggle";
import { registerCustomerPushAction, unregisterCustomerPushAction } from "./push-actions";
import VerifyEmailBanner from "./VerifyEmailBanner";
import SignOutButton from "../components/SignOutButton";
import L from "../components/L";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  // A failed read hides the list; it never breaks the account page.
  // A failed lookup just hides the badge.
  const trusted = await isUserTrusted(user.id).catch((error) => {
    console.error("trusted lookup failed", error);
    return false;
  });
  // Points: a failed read just hides the section.
  const points = await Promise.all([
    getPointsSettings(),
    getPointsBalance(user.id),
    listLedgerForUser(user.id, 50),
  ]).catch((error) => {
    console.error("points read failed", error);
    return null;
  });
  // Offer push only while it is switched on with keys; a failed read hides the button.
  const pushOffered = (await pushAvailable().catch(() => ({ available: false }))).available;
  // Ask to confirm the address only when email can actually be sent; a failed read hides the banner.
  const showVerifyBanner =
    user.email !== null && !isEmailVerified(user) && (await emailAvailable().catch(() => false));
  // The phone section only shows while SMS sign-in is switched on; a failed read hides it.
  const phoneAvailable = await smsAvailable().catch(() => false);
  // Tier, running bonus and expiry: a failed read just hides these lines.
  const extras = points?.[0].enabled
    ? await Promise.all([getLoyaltyStanding(user.id), getExpiryDays(), getLedgerForExpiry(user.id)]).catch((error) => {
        console.error("points v2 read failed", error);
        return null;
      })
    : null;
  const standing = extras?.[0] ?? null;
  const expiry = extras ? expiryPicture(extras[2], extras[1], new Date()) : null;
  const upNext = standing ? nextTier(standing.spend, standing.tiers) : null;
  const orders = await listOrdersForUser(user.id).catch((error) => {
    console.error("orders list failed", error);
    return [];
  });

  const details: { key: string; label: React.ReactNode; value: React.ReactNode }[] = [
    user.email
      ? { key: "email", label: <L si="ඊමේල්" en="Email" />, value: user.email }
      : { key: "phone", label: <L si="දුරකථන අංකය" en="Phone" />, value: user.phone },
    {
      key: "method",
      label: <L si="ඇතුළු වන ක්‍රමය" en="Sign-in method" />,
      value: user.googleId ? "Google" : user.passwordHash ? <L si="මුරපදය" en="Password" /> : <L si="SMS කේතය" en="SMS code" />,
    },
    {
      key: "role",
      label: <L si="ගිණුම් වර්ගය" en="Account type" />,
      value:
        user.role === "admin" ? <L si="පරිපාලක" en="Admin" /> : <L si="පාරිභෝගික" en="Customer" />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">
        <L si="ඔබේ ගිණුම" en="Your account" />
      </p>
      <h1 className="display mt-2 text-5xl">{user.name ?? user.email ?? user.phone}</h1>
      {trusted && (
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-blaze">
          ✓ <L si="තහවුරු කළ පාරිභෝගික" en="Verified customer" />
        </p>
      )}
      <div className="measure mt-6 text-ink" />
      <dl className="mt-8 divide-y divide-line border-y border-line">
        {details.map(({ key, label, value }) => (
          <div key={key} className="flex justify-between gap-4 py-4">
            <dt className="eyebrow text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {showVerifyBanner && <VerifyEmailBanner />}
      {phoneAvailable && <PhoneSection phone={user.phone} />}
      {pushOffered && (
        <section className="mt-8">
          <h2 className="eyebrow text-muted">
            <L si="දැනුම්දීම්" en="Order alerts" />
          </h2>
          <p className="mt-2 text-sm text-muted">
            <L
              si="ඔබේ ඇණවුම් ගැන දැනුම්දීම් මෙම උපාංගයට ලබාගන්න. SMS සහ ඊමේල් වලට අමතරවයි."
              en="Get updates about your orders on this device, in addition to SMS and email."
            />
          </p>
          <div className="mt-3">
            <PushToggle userKey={maskUserId(user.id)} register={registerCustomerPushAction} unregister={unregisterCustomerPushAction} />
          </div>
        </section>
      )}
      {points && (points[0].enabled || points[2].length > 0) && (
        <section className="mt-10">
          <h2 className="eyebrow text-muted">
            <L si="මගේ points" en="My points" />
          </h2>
          <p className="mt-3 font-mono text-2xl">
            {points[1]}{" "}
            <span className="text-sm text-muted">
              <L si="points" en="points" /> ≈ {formatPrice(points[1] * points[0].pointValue)}
            </span>
          </p>
          {standing?.tier && (
            <p className="mt-2 text-sm">
              <L si="ඔබේ level එක" en="Your level" />: <strong>{standing.tier.name}</strong>
              {standing.tier.bonusPercent > 0 && (
                <span className="text-muted">
                  {" "}
                  (<L si={`points ${standing.tier.bonusPercent}% වැඩියෙන්`} en={`+${standing.tier.bonusPercent}% points`} />)
                </span>
              )}
            </p>
          )}
          {upNext && (
            <p className="mt-1 text-sm text-muted">
              <L
                si={`${upNext.tier.name} වෙන්න තව ${formatPrice(upNext.remaining)}ක් ඇණවුම් කරන්න.`}
                en={`Spend ${formatPrice(upNext.remaining)} more on delivered orders to reach ${upNext.tier.name}.`}
              />
            </p>
          )}
          {standing?.bonus && (
            <p className="mt-1 text-sm text-blaze">
              <L
                si={`${standing.bonus.name}: දැන් ඇණවුම් කරන විට points ${standing.bonus.bonusPercent}% වැඩියෙන්!`}
                en={`${standing.bonus.name}: orders placed now earn ${standing.bonus.bonusPercent}% more points!`}
              />
            </p>
          )}
          {expiry && expiry.soon > 0 && expiry.nextAt && (
            <p className="mt-1 text-sm text-muted">
              <L
                si={`points ${expiry.soon}ක් ${expiry.nextAt.toLocaleDateString("en-LK", { timeZone: "Asia/Colombo", day: "numeric", month: "short" })} වන විට කල් ඉකුත් වේ.`}
                en={`${expiry.soon} points expire by ${expiry.nextAt.toLocaleDateString("en-LK", { timeZone: "Asia/Colombo", day: "numeric", month: "short" })}.`}
              />
            </p>
          )}
          {points[2].length > 0 && (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {points[2].map((entry) => {
                const label = ledgerKindLabel(entry.kind);
                return (
                  <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2 text-sm">
                    <span>
                      <L si={label.si} en={label.en} />
                      {entry.orderNumber && (
                        <>
                          {" "}
                          <Link href={`/orders/${entry.orderNumber}`} className="font-mono text-xs underline underline-offset-4">
                            {entry.orderNumber}
                          </Link>
                        </>
                      )}
                      {entry.note && <span className="block text-xs text-muted">{entry.note}</span>}
                    </span>
                    <span className="font-mono">
                      <span className={entry.points > 0 ? "text-blaze" : "text-muted"}>
                        {entry.points > 0 ? "+" : "−"}
                        {Math.abs(entry.points)}
                      </span>{" "}
                      <span className="text-xs text-muted">
                        {new Date(entry.createdAt).toLocaleDateString("en-LK", {
                          timeZone: "Asia/Colombo",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <h2 className="eyebrow mt-10 text-muted">
        <L si="මගේ ඇණවුම්" en="My orders" />
      </h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          <L si="තවම ඇණවුම් නැත." en="No orders yet." />
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {orders.map((order) => {
            const label = statusLabel(order.status);
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.orderNumber}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-surface">
                  <span>
                    <span className="font-mono text-sm">{order.orderNumber}</span>
                    <span className="block font-mono text-xs text-muted">
                      {new Date(order.createdAt).toLocaleDateString("en-LK", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    <L si={label.si} en={label.en} />
                  </span>
                  <span className="font-mono text-sm">{formatPrice(order.total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
