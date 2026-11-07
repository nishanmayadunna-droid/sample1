/** The built-in assistant mascot: an original panda with an orange headband. Replaceable by an upload in /admin/chat. */
export default function MayaMascot({ size = 64, accent = "#d9531e" }: { size?: number; accent?: string }) {
  return (
    <svg viewBox="0 0 200 230" width={size} height={(size * 230) / 200} role="img" aria-label="Assistant mascot" style={{ display: "block" }}>
      <circle cx="56" cy="42" r="19" fill="#1c1c1c" />
      <circle cx="144" cy="42" r="19" fill="#1c1c1c" />
      <ellipse cx="74" cy="208" rx="20" ry="13" fill="#1c1c1c" />
      <ellipse cx="126" cy="208" rx="20" ry="13" fill="#1c1c1c" />
      <ellipse cx="100" cy="168" rx="50" ry="45" fill="#ffffff" stroke="#1c1c1c" strokeWidth="3" />
      <ellipse cx="100" cy="172" rx="30" ry="28" fill="#f1f1ee" />
      <ellipse cx="54" cy="160" rx="13" ry="28" fill="#1c1c1c" transform="rotate(12 54 160)" />
      <ellipse cx="156" cy="132" rx="13" ry="28" fill="#1c1c1c" transform="rotate(-38 156 132)" />
      <circle cx="168" cy="106" r="10" fill="#1c1c1c" />
      <circle cx="100" cy="86" r="54" fill="#ffffff" stroke="#1c1c1c" strokeWidth="3" />
      <rect x="48" y="58" width="104" height="14" rx="3" fill={accent} />
      <path d="M150 62 L176 52 L172 66 L178 80 L152 70 Z" fill={accent} />
      <circle cx="152" cy="66" r="5" fill="#1c1c1c" fillOpacity="0.25" />
      <ellipse cx="76" cy="92" rx="13" ry="17" fill="#1c1c1c" transform="rotate(-22 76 92)" />
      <ellipse cx="124" cy="92" rx="13" ry="17" fill="#1c1c1c" transform="rotate(22 124 92)" />
      <circle cx="78" cy="90" r="6" fill="#ffffff" />
      <circle cx="122" cy="90" r="6" fill="#ffffff" />
      <circle cx="79" cy="91" r="3" fill="#1c1c1c" />
      <circle cx="121" cy="91" r="3" fill="#1c1c1c" />
      <circle cx="80" cy="89.5" r="1.1" fill="#ffffff" />
      <circle cx="122" cy="89.5" r="1.1" fill="#ffffff" />
      <circle cx="64" cy="112" r="7" fill="#f6b5b0" />
      <circle cx="136" cy="112" r="7" fill="#f6b5b0" />
      <ellipse cx="100" cy="106" rx="8" ry="5.5" fill="#1c1c1c" />
      <path d="M90 114 Q100 124 110 114" fill="none" stroke="#1c1c1c" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
