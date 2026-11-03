import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { listReviewsForAdmin } from "@/lib/admin-reviews";
import AdminTabs from "../AdminTabs";
import ReviewRowActions from "./ReviewRowActions";

export const metadata: Metadata = { title: "Admin" };

const stars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");
  const reviews = await listReviewsForAdmin();
  const pendingCount = reviews.filter((review) => review.status === "pending").length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="reviews" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Reviews</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Customers must be signed in to review. A review shows on the shop only once approved.
        {pendingCount > 0 ? ` ${pendingCount} waiting for approval.` : ""}
      </p>

      {reviews.length === 0 ? (
        <p className="mt-8 text-muted">No reviews yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-wrap items-start gap-4 py-4">
              <div className="min-w-64 flex-1">
                <p className="text-sm">
                  <Link href={`/products/${review.productId}`} className="underline-offset-4 hover:underline">
                    {review.productName}
                  </Link>{" "}
                  <span className="text-muted">· {review.authorName} ·</span>{" "}
                  <span className="font-mono text-blaze">{stars(review.rating)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm">{review.body}</p>
                <p className="mt-1 font-mono text-[0.7rem] text-muted">
                  {new Date(review.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                </p>
              </div>
              <span
                className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
                  review.status === "pending" ? "text-blaze" : "text-muted"
                }`}
              >
                {review.status}
              </span>
              <ReviewRowActions id={review.id} status={review.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
