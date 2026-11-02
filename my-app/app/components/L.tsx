/**
 * A Sinhala / English text. Both go into the page; CSS on html[data-lang]
 * shows the chosen one (see globals.css). An empty side shows the other.
 */
export default function L({ si, en }: { si: string; en: string }) {
  return (
    <>
      <span className="l-si">{si || en}</span>
      <span className="l-en">{en || si}</span>
    </>
  );
}
