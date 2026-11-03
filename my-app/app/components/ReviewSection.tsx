import type { RatingSummary, Review } from "@/lib/reviews";
import L from "./L";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";

/** Approved reviews and the review form. Server component; only the form is a client island. */
export default function ReviewSection({
  productId,
  rating,
  reviews,
}: {
  productId: string;
  rating: RatingSummary | null;
  reviews: Review[];
}) {
  return (
    <section className="mt-16" aria-labelledby="reviews-heading">
      <div className="measure mb-8 text-ink" />
      <h2 id="reviews-heading" className="display text-[clamp(1.5rem,3vw,2rem)]">
        <L si="සමාලෝචන" en="Reviews" />
      </h2>
      {rating ? (
        <p className="mt-3 flex items-center gap-3 font-mono text-sm">
          <Stars value={rating.average} />
          <span>{rating.average.toFixed(1)}</span>
          <span className="text-muted">
            <L si={`සමාලෝචන ${rating.count}`} en={`${rating.count} ${rating.count === 1 ? "review" : "reviews"}`} />
          </span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">
          <L si="තවම සමාලෝචන නැත." en="No reviews yet." />
        </p>
      )}

      {reviews.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {reviews.map((review) => (
            <li key={review.id} className="py-4">
              <p className="flex flex-wrap items-center gap-x-3 text-sm">
                <Stars value={review.rating} />
                <span className="font-medium">{review.authorName}</span>
                <span className="font-mono text-xs text-muted">
                  {new Date(review.createdAt).toLocaleDateString("en-LK", {
                    timeZone: "Asia/Colombo",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </p>
              <p className="mt-2 max-w-prose whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <ReviewForm productId={productId} />
      </div>
    </section>
  );
}
