/**
 * A script that runs while the HTML is parsed, before first paint. On the
 * client it renders as text/plain so React doesn't warn about (or re-run) it;
 * suppressHydrationWarning accepts the type difference. See the Next guide
 * "Preventing flash before hydration".
 */
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
