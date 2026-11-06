// Browser-side helpers for push notifications (Firebase Cloud Messaging), shared by
// PushToggle and the sign-out button. Client only. The token goes straight from FCM
// to a Server Action; the only thing kept in localStorage is a short fingerprint of
// it plus WHICH USER enabled push on this browser, so a second person signing in on
// the same browser never inherits the first person's "on".

export const FLAG_KEY = "nb_push_state"; // JSON: { fp, at, uid } — never the token itself
export const REFRESH_AFTER_MS = 7 * 24 * 3600_000;

export type PushState = { fp: string; at: number; uid: string };

export function firebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
  if (![apiKey, projectId, messagingSenderId, appId, vapidKey].every((v) => v.trim() !== "")) return null;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || undefined;
  return { app: { apiKey, projectId, messagingSenderId, appId, authDomain }, vapidKey };
}

/** The saved state, whoever it belongs to (the sign-out button needs it regardless of the user key). */
export function readAnyState(): PushState | null {
  try {
    const raw = window.localStorage.getItem(FLAG_KEY);
    const parsed = raw ? (JSON.parse(raw) as { fp?: unknown; at?: unknown; uid?: unknown }) : null;
    return parsed && typeof parsed.fp === "string" && typeof parsed.at === "number" && typeof parsed.uid === "string"
      ? { fp: parsed.fp, at: parsed.at, uid: parsed.uid }
      : null;
  } catch {
    return null;
  }
}

/** The saved state only when THIS user turned push on in this browser. */
export function readState(uid: string): PushState | null {
  const state = readAnyState();
  return state && state.uid === uid ? state : null;
}

export function writeState(value: PushState | null) {
  try {
    if (value) window.localStorage.setItem(FLAG_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(FLAG_KEY);
  } catch {
    // Storage can be blocked (private window): the feature still works, it just re-registers more often.
  }
}

/** First 16 hex characters of SHA-256: enough to notice a changed token without keeping the token. */
export async function fingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The FCM token of this browser, registering the service worker first. Empty token when FCM cannot give one. */
export async function getFcmToken(): Promise<{ token: string; unsupported: boolean }> {
  const config = firebaseConfig();
  if (!config) return { token: "", unsupported: true };
  const [{ getApp, getApps, initializeApp }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) return { token: "", unsupported: true };
  const app = getApps().length > 0 ? getApp() : initializeApp(config.app);
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  return { token, unsupported: false };
}

/**
 * Called when someone signs out: if push was enabled on this browser, removes its token from
 * their account so their order updates stop arriving here. Does nothing (and loads nothing)
 * when push was never enabled. Never throws.
 */
export async function unregisterThisBrowser(unregister: (token: string) => Promise<unknown>): Promise<void> {
  try {
    if (!readAnyState()) return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const { token, unsupported } = await getFcmToken();
      if (!unsupported && token !== "") await unregister(token);
    }
  } catch {
    // Signing out must never be blocked by push.
  } finally {
    writeState(null);
  }
}
