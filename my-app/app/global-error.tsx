"use client";

// Replaces the root layout when it fails, so it needs its own document and
// must not depend on app components, fonts or styles.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error("global error", error.digest ?? "no-digest");
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem", maxWidth: "40rem", margin: "0 auto" }}>
        <h1>Something went wrong</h1>
        <p>යම් දෙයක් වැරදුණා. Please reload the page.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: "0.75rem 1.25rem" }}>
          Reload / නැවත පූරණය කරන්න
        </button>
      </body>
    </html>
  );
}
