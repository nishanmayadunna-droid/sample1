"use client";

import { useEffect, useState, useTransition } from "react";
import L from "./L";

// Push notifications (Firebase Cloud Messaging) for ONE device. Nothing here runs
// until the person clicks the button: permission is never asked on page load. The
// Firebase SDK is loaded only on that click (or, if the device is already
// enabled, to refresh its token), so ordinary pages never pay for it.
//
// The token goes straight from FCM to a Server Action that takes the user id from
// the session. It is never put in a URL, logged or shown; only a short
// fingerprint is kept in localStorage to notice when FCM rotates it.

type ActionResult = "ok" | "invalid" | "too_many" | "error";

type Support = "checking" | "ok" | "no-config" | "ios-install" | "unsupported";
type Status = "off" | "on" | "denied";
type Message = "denied" | "unsupported" | "too_many" | "error" | null;

const FLAG_KEY = "nb_push_state"; // JSON: { fp, at } — a fingerprint of the token, never the token
const REFRESH_AFTER_MS = 7 * 24 * 3600_000;

function firebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
  if (![apiKey, projectId, messagingSenderId, appId, vapidKey].every((v) => v.trim() !== "")) return null;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || undefined;
  return { app: { apiKey, projectId, messagingSenderId, appId, authDomain }, vapidKey };
}

function readState(): { fp: string; at: number } | null {
  try {
    const raw = window.localStorage.getItem(FLAG_KEY);
    const parsed = raw ? (JSON.parse(raw) as { fp?: unknown; at?: unknown }) : null;
    return parsed && typeof parsed.fp === "string" && typeof parsed.at === "number" ? { fp: parsed.fp, at: parsed.at } : null;
  } catch {
    return null;
  }
}

function writeState(value: { fp: string; at: number } | null) {
  try {
    if (value) window.localStorage.setItem(FLAG_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(FLAG_KEY);
  } catch {
    // Storage can be blocked (private window): the feature still works, it just re-registers more often.
  }
}

/** First 16 hex characters of SHA-256: enough to notice a changed token without keeping the token. */
async function fingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The FCM token of this browser, registering the service worker first. Null when FCM cannot give one. */
async function getFcmToken(): Promise<{ token: string; unsupported: boolean }> {
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

export default function PushToggle({
  register,
  unregister,
}: {
  register: (token: string, platform: string) => Promise<ActionResult>;
  unregister: (token: string) => Promise<ActionResult>;
}) {
  const [support, setSupport] = useState<Support>("checking");
  const [status, setStatus] = useState<Status>("off");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  // Work out what this browser can do, and refresh the token if the device is already on.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      await Promise.resolve();
      if (cancelled) return;
      if (!firebaseConfig()) return setSupport("no-config");
      const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!hasApis) {
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        return setSupport(ios && !standalone ? "ios-install" : "unsupported");
      }
      setSupport("ok");
      if (Notification.permission === "denied") return setStatus("denied");
      const saved = readState();
      if (Notification.permission !== "granted" || !saved) return;
      setStatus("on");
      // Token refresh: FCM can rotate a token. Ask for the current one (no prompt: permission is already
      // granted) and register it again only when it changed, or once a week to keep the device fresh.
      try {
        const { token, unsupported } = await getFcmToken();
        if (cancelled || unsupported || token === "") return;
        const fp = await fingerprint(token);
        if (fp !== saved.fp || Date.now() - saved.at > REFRESH_AFTER_MS) {
          if ((await register(token, "web")) === "ok") writeState({ fp, at: Date.now() });
        }
      } catch {
        // A failed silent refresh changes nothing; the next visit tries again.
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [register]);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        // The permission prompt happens ONLY here, on the click.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          setMessage("denied");
          return;
        }
        const { token, unsupported } = await getFcmToken();
        if (unsupported) return setMessage("unsupported");
        if (token === "") return setMessage("error");
        const result = await register(token, "web");
        if (result === "ok") {
          writeState({ fp: await fingerprint(token), at: Date.now() });
          setStatus("on");
        } else {
          setMessage(result === "too_many" ? "too_many" : "error");
        }
      } catch {
        setMessage("error");
      }
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const { token, unsupported } = await getFcmToken();
        if (!unsupported && token !== "") {
          await unregister(token);
          const [{ getApp }, { getMessaging, deleteToken }] = await Promise.all([
            import("firebase/app"),
            import("firebase/messaging"),
          ]);
          await deleteToken(getMessaging(getApp())).catch(() => false);
        }
        writeState(null);
        setStatus("off");
      } catch {
        setMessage("error");
      }
    });
  }

  if (support === "checking") return null;

  if (support === "no-config") {
    return (
      <p className="text-sm text-muted">
        <L si="දැනට මෙම උපාංගයට push දැනුම්දීම් ලබාගත නොහැක." en="Push alerts aren't available yet." />
      </p>
    );
  }
  if (support === "ios-install") {
    return (
      <p className="text-sm text-muted">
        <L
          si="iPhone/iPad හි push ලැබෙන්නේ අඩවිය Home Screen එකට එකතු කළොත් පමණි: Share බොත්තම ඔබා “Add to Home Screen” තෝරන්න, ඉන්පසු එතැනින් විවෘත කරන්න."
          en='On iPhone/iPad, push only works once this site is added to the Home Screen: tap Share, choose "Add to Home Screen", then open it from there.'
        />
      </p>
    );
  }
  if (support === "unsupported") {
    return (
      <p className="text-sm text-muted">
        <L si="මෙම බ්‍රවුසරය push දැනුම්දීම් සඳහා සහාය නොදක්වයි." en="This browser doesn't support push alerts." />
      </p>
    );
  }

  return (
    <div>
      {status === "on" ? (
        <>
          <p role="status" className="text-sm">
            <L si="මෙම උපාංගයේ දැනුම්දීම් සක්‍රියයි." en="Alerts are on for this device." />
          </p>
          <button
            type="button"
            onClick={disable}
            disabled={pending}
            className="mt-3 rounded-full border border-line px-5 py-2 text-sm transition-colors hover:border-ink disabled:opacity-60"
          >
            <L si="මෙම උපාංගයේ නවත්වන්න" en="Turn off on this device" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={pending || status === "denied"}
          className="rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          <L si="මෙම උපාංගයේ දැනුම්දීම් සක්‍රිය කරන්න" en="Enable alerts on this device" />
        </button>
      )}
      {status === "denied" && (
        <p className="mt-2 text-sm text-blaze">
          <L
            si="බ්‍රවුසරයේ දැනුම්දීම් අවහිර කර ඇත. ලිපිනය අසල ඇති අගුල/සැකසුම් හරහා Allow කර නැවත උත්සාහ කරන්න."
            en="Notifications are blocked in this browser. Allow them from the lock/settings icon next to the address, then try again."
          />
        </p>
      )}
      {message === "denied" && status !== "denied" && (
        <p role="alert" className="mt-2 text-sm text-blaze">
          <L si="අවසරය ලැබුණේ නැහැ." en="Permission wasn't granted." />
        </p>
      )}
      {message === "unsupported" && (
        <p role="alert" className="mt-2 text-sm text-blaze">
          <L si="මෙම බ්‍රවුසරය push සඳහා සහාය නොදක්වයි." en="This browser doesn't support push alerts." />
        </p>
      )}
      {message === "too_many" && (
        <p role="alert" className="mt-2 text-sm text-blaze">
          <L si="උත්සාහ ගොඩක් වුණා. පසුව නැවත උත්සාහ කරන්න." en="Too many tries. Please try again later." />
        </p>
      )}
      {message === "error" && (
        <p role="alert" className="mt-2 text-sm text-blaze">
          <L si="යමක් වැරදුණා, නැවත උත්සාහ කරන්න." en="Something went wrong, please try again." />
        </p>
      )}
    </div>
  );
}
