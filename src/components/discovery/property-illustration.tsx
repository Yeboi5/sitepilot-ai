import type { Listing } from "@/lib/discovery/types";

// Deterministic illustration per listing: no photos until licensed imagery exists (v2.0 §9).
const ROOFS = ["#2f6fed", "#1f9d64", "#c2410c", "#7c3aed", "#0f766e", "#b45309"];
const WALLS = ["#ffffff", "#fef3c7", "#e0f2fe", "#fce7f3", "#ecfccb", "#f5f1e9"];

function pick<T>(arr: readonly T[], seed: number, salt: number) {
  return arr[Math.abs(seed * 31 + salt * 17) % arr.length]!;
}

export function PropertyIllustration({
  type,
  kind,
  seed,
  className,
}: {
  type: Listing["property_type"];
  kind: Listing["kind"];
  seed: number;
  className?: string;
}) {
  const roof = pick(ROOFS, seed, 1);
  const wall = pick(WALLS, seed, 2);
  const sky = kind === "home" ? ["#dbeafe", "#eef6ff"] : ["#d3f3e2", "#edfaf3"];
  const sunX = 60 + (seed % 5) * 55;
  const trees = 1 + (seed % 3);
  const gid = `sky-${seed}-${kind}`;

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${gid})`} />
      <circle cx={sunX} cy="52" r="22" fill="#fde68a" />
      <path d="M0 196c70-20 140-22 210-10s130 8 190-6v60H0z" fill="#a8e5c6" />
      {Array.from({ length: trees }, (_, i) => {
        const x = 30 + i * 330 / trees + (seed % 20);
        return (
          <g key={i}>
            <rect x={x - 3} y="160" width="6" height="34" rx="3" fill="#6d6355" />
            <circle cx={x} cy="152" r="18" fill="#1f9d64" opacity="0.85" />
          </g>
        );
      })}
      {type === "land" ? (
        <g>
          <path d="M120 200h170" stroke="#6d6355" strokeWidth="3" strokeDasharray="10 8" />
          <rect x="190" y="170" width="44" height="26" rx="4" fill="#ffffff" stroke="#6d6355" strokeWidth="2" />
          <path d="M200 182h24" stroke="#6d6355" strokeWidth="3" />
        </g>
      ) : type === "apartment" ? (
        <g>
          <rect x="150" y="70" width="110" height="128" rx="8" fill={wall} stroke={roof} strokeWidth="4" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={164 + c * 30} y={84 + r * 26} width="18" height="16" rx="3" fill="#bcd8fb" />),
          )}
        </g>
      ) : (
        <g>
          {(type === "townhouse" || type === "duplex" ? [0, 1] : [0]).map((u) => {
            const x = (type === "house" ? 140 : 110) + u * 100;
            return (
              <g key={u}>
                <rect x={x} y="120" width="100" height="78" rx="8" fill={wall} stroke={roof} strokeWidth="3" />
                <path d={`M${x - 10} 126 ${x + 50} 80l60 46`} fill="none" stroke={roof} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
                <rect x={x + 38} y="152" width="24" height="46" rx="6" fill={roof} opacity="0.35" />
                <rect x={x + 12} y="136" width="18" height="16" rx="3" fill="#bcd8fb" />
                <rect x={x + 70} y="136" width="18" height="16" rx="3" fill="#bcd8fb" />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
