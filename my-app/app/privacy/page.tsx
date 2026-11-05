import type { Metadata } from "next";
import { getStoreContact } from "@/lib/store-contact-data";
import { mailHref, telHref, whatsappHref } from "@/lib/store-contact";
import L from "../components/L";
import StorePage, { Bullets, Section } from "../components/StorePage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Privacy",
  description: "What information we collect and why.",
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
            si="ඇණවුම් සකස් කිරීමට, බෙදා හැරීමට, ඔබේ ගිණුම පවත්වා ගැනීමට සහ ඔබ ඉල්ලන ඊමේල් යැවීමට පමණි."
            en="Only to process and deliver orders, run your account, and send the emails you ask for."
          />
        </p>
      </Section>
      <Section title={<L si="සේවා සපයන්නන්" en="Services we use" />}>
        <p>
          <L
            si="දත්ත ගබඩා කිරීම සහ වෙබ් අඩවිය ධාවනය සඳහා Supabase සහ Vercel, සහ SMS සඳහා Text.lk භාවිතා කෙරේ."
            en="We use Supabase and Vercel to store data and run the site, and Text.lk for SMS."
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
