export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "text-xs text-slate-500" : "text-xs leading-relaxed text-slate-500"}>
      SitePilot AI is a pre-release product. It does not provide legal, planning, financial or tax advice. AI output is
      flagged for review by a licensed professional and is never a legal conclusion. Feasibility figures are estimates based
      on your assumptions. No client funds, settlements or lodgements are handled by this platform.
    </p>
  );
}
