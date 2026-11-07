/**
 * Injects the shop's colour theme. The CSS comes from themeCss(), which writes only validated
 * #rrggbb colours (anything else is left out), so there is nothing to escape or inject.
 */
export default function ThemeStyle({ css }: { css: string }) {
  return <style>{css}</style>;
}
