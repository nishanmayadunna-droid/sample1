// Sign-in / sign-up messages in both languages. Server code returns a code;
// the form shows the text in the visitor's language.

export const AUTH_MESSAGES = {
  invalidEmail: { si: "වලංගු ඊමේල් ලිපිනයක් ඇතුළත් කරන්න.", en: "Enter a valid email address." },
  passwordLength: { si: "මුරපදය අකුරු 8–72ක් විය යුතුයි.", en: "Password must be 8–72 characters." },
  nameTooLong: { si: "නම අකුරු 100කට වඩා අඩු විය යුතුයි.", en: "Name must be 100 characters or fewer." },
  emailTaken: { si: "මෙම ඊමේල් එකට දැනටමත් ගිණුමක් ඇත.", en: "This email already has an account." },
  somethingWrong: { si: "යමක් වැරදුණා, නැවත උත්සාහ කරන්න.", en: "Something went wrong, please try again." },
  invalidCredentials: { si: "ඊමේල් හෝ මුරපදය වැරදියි.", en: "Invalid email or password." },
  googleAccount: { si: "මෙම ගිණුම Google හරහා ඇතුළු වේ.", en: "This account uses Google sign-in." },
  passwordAccount: {
    si: "මෙම ඊමේල් එක මුරපදයක් භාවිතා කරයි. මුරපදයෙන් ඇතුළු වන්න.",
    en: "This email uses a password. Sign in with your password.",
  },
  signInFailed: { si: "ඇතුළු වීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", en: "Sign-in failed. Please try again." },
  invalidPhone: { si: "වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න (07XXXXXXXX).", en: "Enter a valid phone number (07XXXXXXXX)." },
  codeInvalid: { si: "කේතය වැරදියි හෝ කල් ඉකුත් වී ඇත.", en: "That code is wrong or has expired." },
  codeTooSoon: { si: "කරුණාකර මද වෙලාවක් රැඳී නැවත උත්සාහ කරන්න.", en: "Please wait a moment before asking for another code." },
  codeLimit: { si: "කේත ඉල්ලීම් ගණන සීමාව ඉක්මවා ඇත. පසුව උත්සාහ කරන්න.", en: "Too many code requests. Please try again later." },
  smsUnavailable: { si: "දුරකථනයෙන් ඇතුළු වීම දැනට ලබාගත නොහැක.", en: "Phone sign-in isn't available right now." },
  phoneSame: { si: "මෙය දැනටමත් ඔබේ දුරකථන අංකයයි.", en: "That is already your phone number." },
  phoneChangeTooSoon: {
    si: "දුරකථන අංකය වෙනස් කළ හැක්කේ දිනකට වරක් පමණි. පසුව උත්සාහ කරන්න.",
    en: "You can change your phone number once a day. Please try again later.",
  },
  smsSendFailed: { si: "කේතය යැවීමට නොහැකි විය. නැවත උත්සාහ කරන්න.", en: "We couldn't send the code. Please try again." },
} satisfies Record<string, { si: string; en: string }>;

export type AuthMessage = keyof typeof AUTH_MESSAGES;

const SIGN_IN_ERRORS: Record<string, AuthMessage> = {
  OAuthAccountNotLinked: "passwordAccount",
  CredentialsSignin: "invalidCredentials",
};

/** The message for an Auth.js `?error=` code on /signin. */
export function signInErrorMessage(code: string | null): AuthMessage | null {
  if (!code) return null;
  // hasOwn: `?error=constructor` must not resolve to Object.prototype members.
  return Object.hasOwn(SIGN_IN_ERRORS, code) ? SIGN_IN_ERRORS[code] : "signInFailed";
}
