// Server-side review moderation for /admin/reviews. Uses the secret-key client;
// callers must check requireAdmin() first (app/admin/reviews/actions.ts does).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type AdminReview = {
  id: string;
  productId: string;
  productName: string;
  authorName: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: string;
};

type Row = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  created_at: string;
  products: { name: string } | null;
};

function fail(error: unknown): never {
  console.error("admin reviews query failed", error);
  throw new Error("admin reviews query failed");
}

const STATUS_ORDER: Record<ReviewStatus, number> = { pending: 0, approved: 1, rejected: 2 };

/** Pending first, then newest first. */
export async function listReviewsForAdmin(): Promise<AdminReview[]> {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, product_id, author_name, rating, body, status, created_at, products(name)")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Row[]>();
  if (error) fail(error);
  return data
    .map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.products?.name ?? row.product_id,
      authorName: row.author_name,
      rating: row.rating,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

/** Returns the review's product id, or null when no review had this id. */
export async function setReviewStatus(
  id: string,
  status: "approved" | "rejected",
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .update({ status })
    .eq("id", id)
    .select("product_id")
    .returns<{ product_id: string }[]>();
  if (error) fail(error);
  return data[0]?.product_id ?? null;
}

/** Returns the deleted review's product id, or null when no review had this id. */
export async function deleteReview(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .delete()
    .eq("id", id)
    .select("product_id")
    .returns<{ product_id: string }[]>();
  if (error) fail(error);
  return data[0]?.product_id ?? null;
}
