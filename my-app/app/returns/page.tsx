import type { Metadata } from "next";
import { getStoreContact } from "@/lib/store-contact-data";
import { mailHref, telHref, whatsappHref } from "@/lib/store-contact";
import L from "../components/L";
import StorePage, { Bullets, Section } from "../components/StorePage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Returns",
  description: "Our returns policy.",
};

export default async function ReturnsPage() {
  const c = await getStoreContact();
  const days = c.returnDays;
  const how: string[] = [];
  if (telHref(c.phone)) how.push(c.phone);
  if (whatsappHref(c.whatsapp)) how.push(`WhatsApp ${c.whatsapp}`);
  if (mailHref(c.email)) how.push(c.email);

  return (
    <StorePage
      eyebrow={<L si="ප්‍රතිපත්තිය" en="Policy" />}
      title={<L si="ආපසු භාර දීම" en="Returns" />}
    >
      <Section title={<L si="කාලසීමාව" en="Return window" />}>
        {days === 0 ? (
          <p>
            <L
              si="අපි සාමාන්‍යයෙන් ආපසු භාර ගන්නේ නැත; දෝෂ සහිත හෝ වැරදි භාණ්ඩ හැර."
              en="We do not accept returns, except for faulty or wrong items."
            />
          </p>
        ) : (
          <p>
            <L
              si={`භාණ්ඩය ලැබී දින ${days} ක් ඇතුළත ආපසු භාර දිය හැක.`}
              en={`You can return an item within ${days} day${days === 1 ? "" : "s"} of receiving it.`}
            />
          </p>
        )}
      </Section>
      <Section
        title={
          days > 0 ? (
            <L si="කොන්දේසි" en="Conditions" />
          ) : (
            <L si="දෝෂ සහිත හෝ වැරදි භාණ්ඩ" en="Faulty or wrong items" />
          )
        }
      >
        <Bullets>
          {days > 0 && (
            <li>
              <L
                si="භාණ්ඩය භාවිතා නොකළ, ටැග් සහිත තත්ත්වයේ තිබිය යුතුය."
                en="The item must be unused and still have its tags."
              />
            </li>
          )}
          <li>
            <L
              si="දෝෂ සහිත හෝ වැරදි භාණ්ඩයක් ලැබුණේ නම් කරුණාකර වහාම දන්වන්න."
              en="If you received a faulty or wrong item, please tell us right away."
            />
          </li>
        </Bullets>
      </Section>
      <Section title={<L si="ආපසු භාර දෙන ආකාරය" en="How to request a return" />}>
        <p>
          <L
            si="ඔබේ ඇණවුම් අංකය සමඟ අප හා සම්බන්ධ වන්න. අපි ඉදිරි පියවර දන්වමු."
            en="Contact us with your order number and we will tell you the next steps."
          />
        </p>
        {how.length > 0 && <p className="font-medium">{how.join(" · ")}</p>}
      </Section>
      <Section title={<L si="මුදල් ආපසු ගෙවීම" en="Refunds" />}>
        <p>
          <L
            si="ආපසු ගෙවීම් (ගෙවා ඇති අත්තිකාරම ඇතුළුව) ඔබ සමඟ එකඟ වී ක්‍රමයකට සිදු කෙරේ."
            en="Refunds, including any advance you paid, are arranged with you case by case."
          />
        </p>
      </Section>
    </StorePage>
  );
}
