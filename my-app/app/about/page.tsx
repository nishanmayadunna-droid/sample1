import type { Metadata } from "next";
import L from "../components/L";
import StorePage, { Bullets, Section } from "../components/StorePage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "About",
  description: "Who we are and how Northbound picks and sells hard-wearing apparel.",
};

export default function AboutPage() {
  return (
    <StorePage eyebrow={<L si="අප ගැන" en="About us" />} title="Northbound">
      <p>
        <L
          si="Northbound යනු ඉවත දමන්න නොව, දිගු කලක් අඳින්නට සාදන ඇඳුම් වෙළඳසැලකි. සරල, ශක්තිමත් ඇඳුම් තෝරාගෙන ඔබ අතට ගෙන ඒම අපගේ අරමුණයි."
          en="Northbound is an apparel shop built around one idea: clothes made to be worn out, not thrown out. We pick simple, sturdy pieces and bring them to your door."
        />
      </p>
      <Section title={<L si="අපි වැඩ කරන ආකාරය" en="How we work" />}>
        <Bullets>
          <li>
            <L
              si="භාණ්ඩ ලැබුණු පසු මුදල් ගෙවන්න (Cash on Delivery)."
              en="Pay when your order arrives (cash on delivery)."
            />
          </li>
          <li>
            <L
              si="අලුත් ගනුදෙනුකරුවන්ට කුඩා අත්තිකාරම් මුදලක් බැංකු ගෙවීමෙන් ගෙවීමට සිදු විය හැක."
              en="New customers may be asked to pay a small advance by bank transfer."
            />
          </li>
          <li>
            <L
              si="ප්‍රවාහන ගාස්තුව ඔබේ දිස්ත්‍රික්කය අනුව තීරණය වේ; ඇණවුම් කිරීමට පෙර පෙන්වයි."
              en="The delivery fee depends on your district and is shown before you order."
            />
          </li>
          <li>
            <L
              si="ඔබේ ඇණවුම ගිණුමෙන් බලා, යවා ඇති විට ලුහුබඳින්න."
              en="Follow your order from your account, including tracking once it ships."
            />
          </li>
          <li>
            <L
              si="ඔබ මිලදී ගත් දේ ගැන සමාලෝචන ලියන්න."
              en="Leave a review of what you bought."
            />
          </li>
        </Bullets>
      </Section>
      <p>
        <L si="ප්‍රශ්නයක් ඇත්නම් සම්බන්ධ වන්න පිටුව බලන්න." en="Questions? See our Contact page." />
      </p>
    </StorePage>
  );
}
