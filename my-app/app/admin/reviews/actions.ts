"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { deleteReview, setReviewStatus } from "@/lib/admin-reviews";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type ReviewRowState = { error: string | null };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ratings show on cards (home, /products) and the product page.
function revalidateReviews(productId: string) {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/admin/reviews");
}

export async function setReviewStatusAction(id: string, status: string): Promise<ReviewRowState> {
  await requireAdmin("/admin/reviews");
  if (!UUID.test(id) || (status !== "approved" && status !== "rejected")) {
    return { error: SOMETHING_WRONG };
  }
  try {
    const productId = await setReviewStatus(id, status);
    if (!productId) return { error: "That review no longer exists." };
    revalidateReviews(productId);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  return { error: null };
}

export async function deleteReviewAction(id: string): Promise<ReviewRowState> {
  await requireAdmin("/admin/reviews");
  if (!UUID.test(id)) return { error: SOMETHING_WRONG };
  try {
    const productId = await deleteReview(id);
    if (!productId) return { error: "That review no longer exists." };
    revalidateReviews(productId);
  } catch {
    return { error: SOMETHING_WRONG };
  }
  return { error: null };
}
