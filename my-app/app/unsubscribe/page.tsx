import type { Metadata } from "next";
import L from "../components/L";
import UnsubscribeButton from "./UnsubscribeButton";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

// Reading the token never changes anything: only the confirm button does.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <h1 className="display text-4xl">
        <L si="පුවත් ලිපියෙන් ඉවත් වන්න" en="Unsubscribe" />
      </h1>
      {token === "" ? (
        <p className="mt-6 text-muted">
          <L
            si="මෙම සබැඳිය වලංගු නැත. ඊමේල් එකේ ඇති සබැඳිය භාවිත කරන්න."
            en="This link isn't valid. Please use the link from the email."
          />
        </p>
      ) : (
        <>
          <p className="mt-6 text-muted">
            <L
              si="අපගේ පුවත් ලිපි ලැබීම නවත්වන්න ඔබට අවශ්‍ය බව තහවුරු කරන්න."
              en="Confirm that you want to stop receiving our emails."
            />
          </p>
          <UnsubscribeButton token={token} />
        </>
      )}
    </div>
  );
}
