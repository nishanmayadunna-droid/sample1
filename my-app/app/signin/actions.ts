"use server";

import { validateSignUp, type SignUpErrors } from "@/lib/auth-rules";
import { createPasswordUser } from "@/lib/users";

export type SignUpState = {
  ok: boolean;
  errors: SignUpErrors;
  formError: string | null;
};

// Creates the account only. The client signs in afterwards with
// next-auth/react, so the browser navigates and the Header's session is fresh.
export async function signUpAction(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const result = validateSignUp({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!result.ok) return { ok: false, errors: result.errors, formError: null };

  try {
    const created = await createPasswordUser(result.value);
    if (created === "exists") {
      return {
        ok: false,
        errors: { email: "This email already has an account." },
        formError: null,
      };
    }
  } catch {
    return {
      ok: false,
      errors: {},
      formError: "Something went wrong, please try again.",
    };
  }
  return { ok: true, errors: {}, formError: null };
}
