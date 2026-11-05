import type { Metadata } from "next";
import L from "../components/L";
import StorePage, { Bullets, Section } from "../components/StorePage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for shopping with us.",
};

export default function TermsPage() {
  return (
    <StorePage
      eyebrow={<L si="ප්‍රතිපත්තිය" en="Policy" />}
      title={<L si="කොන්දේසි" en="Terms" />}
    >
      <p className="text-muted">
        <L si="අවසන් යාවත්කාලීන: 2026-11-10" en="Last updated: 2026-11-10" />
      </p>
      <Section title={<L si="ගෙවීම" en="Payment" />}>
        <Bullets>
          <li>
            <L
              si="ඇණවුම් Cash on Delivery ලෙස ගෙවනු ලැබේ."
              en="Orders are paid in cash on delivery."
            />
          </li>
          <li>
            <L
              si="අලුත් ගනුදෙනුකරුවන්ට බැංකු ගෙවීමෙන් කුඩා අත්තිකාරමක් ඉල්ලා සිටිය හැක; එය ගෙවන තෙක් ඇණවුම තහවුරු නොවේ."
              en="New customers may be asked for a small advance by bank transfer; the order is not confirmed until it is paid."
            />
          </li>
          <li>
            <L si="සියලු මිල ශ්‍රී ලංකා රුපියල් (LKR) වලින් වේ." en="All prices are in Sri Lankan rupees (LKR)." />
          </li>
        </Bullets>
      </Section>
      <Section title={<L si="ඇණවුම්" en="Orders" />}>
        <Bullets>
          <li>
            <L
              si="ඇණවුම තවමත් පොරොත්තු තත්ත්වයේ ඇති තාක් ඔබට එය අවලංගු කළ හැක."
              en="You can cancel an order while it is still pending."
            />
          </li>
          <li>
            <L
              si="අත්තිකාරම් ඉල්ලූ ඇණවුමක් ගෙවා නොමැති නම්, සාප්පුවේ නියමිත රැඳී සිටීමේ කාලයෙන් පසු ස්වයංක්‍රීයව අවලංගු වේ."
              en="An order that needs an advance is cancelled automatically if the advance is not paid within the shop's waiting period."
            />
          </li>
          <li>
            <L
              si="තොග හෝ මිල වැරදීමක් සිදු වූයේ නම් අපට ඇණවුමක් අවලංගු කිරීමට හැක."
              en="If a stock or price error occurs, we may cancel the order."
            />
          </li>
        </Bullets>
      </Section>
      <Section title={<L si="බෙදාහැරීම" en="Delivery" />}>
        <p>
          <L
            si="බෙදාහැරීමේ කාල ඇස්තමේන්තු පමණි. ගාස්තුව ඔබේ දිස්ත්‍රික්කය අනුව වෙනස් වේ."
            en="Delivery times are estimates only. The fee depends on your district."
          />
        </p>
      </Section>
      <Section title={<L si="ආපසු භාර දීම" en="Returns" />}>
        <p>
          <L si="ආපසු භාර දීමේ පිටුව බලන්න." en="See our Returns page for the return policy." />
        </p>
      </Section>
      <p className="text-muted">
        <L si="මෙය කෙටුම්පත් කොන්දේසි වේ; වෙනස් විය හැක." en="These are draft terms and may change." />
      </p>
    </StorePage>
  );
}
