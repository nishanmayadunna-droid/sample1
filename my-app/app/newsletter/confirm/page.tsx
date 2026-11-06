import type { Metadata } from "next";
import { isTokenShape } from "@/lib/email";
import ConfirmLinkButton from "../../components/ConfirmLinkButton";
import L from "../../components/L";
import { confirmNewsletterAction } from "./actions";

// The token is in the URL, so keep it out of Referer headers and search engines.
export const metadata: Metadata = {
  title: "Confirm subscription",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Opening the link never changes anything: only the confirm button does.
export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <h1 className="display text-4xl">
        <L si="දායකත්වය තහවුරු කරන්න" en="Confirm your subscription" />
      </h1>
      {isTokenShape(token) ? (
        <>
          <p className="mt-6 text-muted">
            <L
              si="අපගේ මාසික ඊමේල් එක ලැබීමට ඔබට අවශ්‍ය බව තහවුරු කරන්න."
              en="Confirm that you want to receive our monthly email."
            />
          </p>
          <ConfirmLinkButton
            token={token}
            action={confirmNewsletterAction}
            label={{ si: "ඔව්, දායක කරන්න", en: "Yes, subscribe me" }}
            done={{ si: "ස්තූතියි! ඔබ දැන් ලැයිස්තුවේ ඉන්නවා.", en: "Thank you! You're on the list." }}
          />
        </>
      ) : (
        <p className="mt-6 text-muted">
          <L si="මෙම සබැඳිය වලංගු නැත." en="This link isn't valid." />
        </p>
      )}
    </div>
  );
}
