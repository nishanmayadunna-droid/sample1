"use server";

import { requireUser } from "@/lib/auth-guards";
import { getProduct } from "@/lib/catalog";
import { firstName, validateReview, type ReviewMessage } from "@/lib/reviews";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Saves the signed-in customer's review of a product as pending (a repeat
 * submission edits their one review and sends it back for approval). Returns a
 * message code, never text. The user id comes from the session only.
 */
export async function submitReview(
  productId: string,
  rating: unknown,
  body: unknown,
): Promise<{ message: ReviewMessage }> {
  if (typeof productId !== "string") return { message: "error" };
  const user = await requireUser(`/products/${productId}`);

  const checked = validateReview({ rating, body });
  if (!checked.ok) return { message: checked.error };

  try {
    // Hidden or unknown products can't be reviewed.
    if (!(await getProduct(productId))) return { message: "error" };
    const { error } = await supabaseAdmin.from("reviews").upsert(
      {
        product_id: productId,
        user_id: user.id,
        author_name: firstName(user.name, user.email).slice(0, 60),
        rating: checked.rating,
        body: checked.body,
        status: "pending",
        created_at: new Date().toISOString(),
      },
      { onConflict: "product_id,user_id" },
    );
    if (error) {
      console.error("review save failed", error);
      return { message: "error" };
    }
  } catch (error) {
    console.error("review save failed", error);
    return { message: "error" };
  }
  return { message: "saved" };
}
