/** Decorative hero illustration: two homes, a tree and the sun. No photos (none are licensed yet). */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="hero-illustration-clip">
          <rect width="320" height="220" rx="28" />
        </clipPath>
      </defs>
      <g clipPath="url(#hero-illustration-clip)">
      <circle cx="252" cy="58" r="30" fill="#fde68a" />
      <circle cx="252" cy="58" r="44" fill="#fde68a" opacity="0.35" />
      <path d="M0 186c60-26 120-30 170-18s100 10 150-6v58H0z" fill="#d3f3e2" />
      <path d="M0 200c80-16 160-14 220-4s70 6 100 0v24H0z" fill="#a8e5c6" />
      {/* Home 1 */}
      <rect x="48" y="112" width="96" height="74" rx="10" fill="#ffffff" stroke="#bcd8fb" strokeWidth="3" />
      <path d="M38 118 96 72l58 46" fill="none" stroke="#2f6fed" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="84" y="146" width="24" height="40" rx="6" fill="#bcd8fb" />
      <rect x="60" y="128" width="18" height="16" rx="4" fill="#eef6ff" stroke="#bcd8fb" strokeWidth="2" />
      <rect x="114" y="128" width="18" height="16" rx="4" fill="#eef6ff" stroke="#bcd8fb" strokeWidth="2" />
      {/* Home 2 */}
      <rect x="170" y="130" width="78" height="56" rx="10" fill="#ffffff" stroke="#a8e5c6" strokeWidth="3" />
      <path d="M162 136l47-36 47 36" fill="none" stroke="#1f9d64" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="198" y="156" width="22" height="30" rx="6" fill="#d3f3e2" />
      {/* Tree */}
      <rect x="273" y="150" width="6" height="36" rx="3" fill="#6d6355" />
      <circle cx="276" cy="140" r="20" fill="#1f9d64" opacity="0.85" />
      {/* Sparkle */}
      <path d="M150 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#2f6fed" opacity="0.5" />
      </g>
    </svg>
  );
}
