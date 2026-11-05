import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStoreContact } from "@/lib/store-contact-data";
import { mailHref, telHref, whatsappHref } from "@/lib/store-contact";
import L from "../components/L";
import StorePage from "../components/StorePage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach us.",
};

const linkClass = "text-blaze underline underline-offset-4";

export default async function ContactPage() {
  const c = await getStoreContact();
  const tel = telHref(c.phone);
  const wa = whatsappHref(c.whatsapp);
  const mail = mailHref(c.email);

  const rows: { label: ReactNode; value: ReactNode }[] = [];
  if (c.phone)
    rows.push({
      label: <L si="දුරකථනය" en="Phone" />,
      value: tel ? (
        <a href={tel} className={linkClass}>
          {c.phone}
        </a>
      ) : (
        c.phone
      ),
    });
  if (c.whatsapp)
    rows.push({
      label: "WhatsApp",
      value: wa ? (
        <a href={wa} className={linkClass} target="_blank" rel="noopener noreferrer">
          {c.whatsapp}
        </a>
      ) : (
        c.whatsapp
      ),
    });
  if (c.email)
    rows.push({
      label: <L si="ඊමේල්" en="Email" />,
      value: mail ? (
        <a href={mail} className={linkClass}>
          {c.email}
        </a>
      ) : (
        c.email
      ),
    });
  if (c.address)
    rows.push({
      label: <L si="ලිපිනය" en="Address" />,
      value: <span className="whitespace-pre-line">{c.address}</span>,
    });
  if (c.hours) rows.push({ label: <L si="වේලාවන්" en="Hours" />, value: c.hours });

  return (
    <StorePage
      eyebrow={<L si="අප හා සම්බන්ධ වන්න" en="Get in touch" />}
      title={<L si="සම්බන්ධ වන්න" en="Contact" />}
    >
      {c.businessName && <p className="font-medium">{c.businessName}</p>}
      {rows.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[8rem_1fr]">
          {rows.map((row, i) => (
            <div key={i} className="contents">
              <dt className="eyebrow text-muted">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>
          <L
            si="අපගේ සම්බන්ධ වීමේ විස්තර ඉක්මනින් මෙහි එක් කෙරේ."
            en="Our contact details will be added here soon."
          />
        </p>
      )}
    </StorePage>
  );
}
