import type { Metadata } from "next";
import { getStoreContact } from "@/lib/store-contact-data";
import { mailHref, telHref, whatsappHref } from "@/lib/store-contact";
import L from "../components/L";
import StorePage, { Bullets, Section } from "../components/StorePage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Privacy",
  description: "What personal information Northbound collects and why.",
};

export default async function PrivacyPage() {
  const c = await getStoreContact();
  const how: string[] = [];
  if (telHref(c.phone)) how.push(c.phone);
  if (whatsappHref(c.whatsapp)) how.push(`WhatsApp ${c.whatsapp}`);
  if (mailHref(c.email)) how.push(c.email);

  return (
    <StorePage
      eyebrow={<L si="ප්‍රතිපත්තිය" en="Policy" />}
      title={<L si="රහස්‍යතාව" en="Privacy" />}
    >
      <p className="text-muted">
        <L si="අවසන් යාවත්කාලීන: 2026-11-10" en="Last updated: 2026-11-10" />
      </p>
      <Section title={<L si="අප එකතු කරන තොරතුරු" en="What we collect" />}>
        <Bullets>
          <li>
            <L
              si="ගිණුම: ඔබේ නම, ඊමේල් ලිපිනය (හෝ Google / දුරකථන ලොගින් තොරතුරු)."
              en="Account: your name and email address (or your Google or phone sign-in details)."
            />
          </li>
          <li>
            <L
              si="බෙදාහැරීම: ලිපිනය, දිස්ත්‍රික්කය සහ දුරකථන අංකය."
              en="Delivery: your address, district and phone number."
            />
          </li>
          <li>
            <L
              si="ඇණවුම්, ගෙවීම් ලදුපත් (අත්තිකාරම් සඳහා), ලකුණු සහ ඔබ ලියන සමාලෝචන."
              en="Orders, payment slips (for advances), points and the reviews you write."
            />
          </li>
          <li>
            <L si="ඔබ දායක වන්නේ නම් පුවත්පත් ඊමේල් ලිපිනය." en="Your email for the newsletter, if you subscribe." />
          </li>
        </Bullets>
        <p>
          <L
            si="අපි බැංකු කාඩ්පත් තොරතුරු එකතු නොකරමු."
            en="We do not collect bank card details."
          />
        </p>
      </Section>
      <Section title={<L si="අප එය භාවිතා කරන ආකාරය" en="How we use it" />}>
        <p>
          <L
            si="ඇණවුම් සකස් කිරීමට, බෙදා හැරීමට, ඔබේ ගිණුම පවත්වා ගැනීමට සහ බෙදාහැරීම සම්බන්ධයෙන් ඔබ අමතන්නටය."
            en="To process and deliver orders, run your account, and contact you about delivery."
          />
        </p>
        <Bullets>
          <li>
            <L
              si="අපගේ SMS සේවාව (Text.lk) හරහා ඇණවුම් යාවත්කාලීන SMS සහ ලොගින් කේත යැවීම."
              en="Sending order-update SMS messages and sign-in codes through our SMS provider (Text.lk)."
            />
          </li>
          <li>
            <L
              si="ඔබ ලියන සමාලෝචන ඔබේ මුල් නමින් පමණක් ප්‍රසිද්ධියේ පෙන්වයි."
              en="Reviews you write are shown publicly with your first name."
            />
          </li>
          <li>
            <L
              si="ඔබ දායක වන්නේ නම් පුවත්පත් ඊමේල්."
              en="Newsletter emails if you subscribe."
            />
          </li>
        </Bullets>
      </Section>
      <Section title={<L si="සේවා සපයන්නන්" en="Services we use" />}>
        <p>
          <L
            si="දත්ත ගබඩා කිරීම සහ වෙබ් අඩවිය ධාවනය සඳහා Supabase සහ Vercel, SMS සඳහා Text.lk, සහ ලොගින් සඳහා Google භාවිතා කෙරේ."
            en="We use Supabase and Vercel to store data and run the site, Text.lk for SMS, and Google for sign-in."
          />
        </p>
      </Section>
      <Section title={<L si="ඔබේ දත්ත මකා දැමීම" en="Deleting your data" />}>
        <p>
          <L
            si="ඔබේ දත්ත බැලීමට හෝ මකා දැමීමට ඉල්ලීමට පහත ආකාරයෙන් අප හා සම්බන්ධ වන්න."
            en="To ask to see or delete your data, contact us using the details below."
          />
        </p>
        <p>
          <L
            si="ඇණවුම් වාර්තා ගිණුම්කරණය සහ බෙදාහැරීමේ වාර්තා සඳහා තබා ගනී; එබැවින් මකා දැමීමේ ඉල්ලීමට ගිණුම් විස්තර ඇතුළත් වන අතර ඇණවුම් තබා ගත හැක."
            en="Order records are kept for the shop's accounting and delivery records, so a deletion request covers your account details but orders may be kept."
          />
        </p>
        <p className="font-medium">
          {how.length > 0 ? (
            how.join(" · ")
          ) : (
            <L si="සම්බන්ධ වීමේ විස්තර ඉක්මනින් එක් කෙරේ." en="Contact details are coming soon." />
          )}
        </p>
      </Section>
      <p className="text-muted">
        <L
          si="මෙය කෙටුම්පත් ප්‍රතිපත්තියකි."
          en="This is a draft policy and may change."
        />
      </p>
    </StorePage>
  );
}
