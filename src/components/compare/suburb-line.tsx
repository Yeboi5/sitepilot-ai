import Link from "next/link";
import { formatAud, formatRatio } from "@/lib/format";
import { suburbHref } from "@/lib/suburbs/links";
import { sampleNote, type SuburbSnapshot } from "@/lib/suburbs/stats";

/** A property's suburb market in plain language, every figure with its sales count. */
export function SuburbLine({ s, compact = false }: { s: SuburbSnapshot | null; compact?: boolean }) {
  if (!s) return <span className="text-slate-500">No suburb sales history for this property type yet.</span>;
  const word = s.type === "house" ? "houses" : "units";
  return (
    <span className={compact ? "text-xs" : "text-sm"}>
      {s.median != null ? (
        <>
          {s.suburb} {word}: median {formatAud(s.median)} ({sampleNote(s.sales12).label.toLowerCase()} in 12 months)
        </>
      ) : (
        <>No {word} sold in {s.suburb} in the past 12 months</>
      )}
      {s.change12 ? `; ${s.change12.change >= 0 ? "up" : "down"} ${formatRatio(Math.abs(s.change12.change))} on the year before (${s.change12.fromCount} → ${s.change12.toCount} sales)` : ""}
      {s.growth ? `; ${formatRatio(s.growth.perYear)} a year over ${s.growth.years} year${s.growth.years === 1 ? "" : "s"}` : ""}.
      {s.isDemo ? " DEMO figures." : ""} Historical, not a forecast.{" "}
      <Link href={suburbHref(s.state, s.suburb, s.postcode)} className="font-semibold text-brand-700 underline">
        Suburb profile
      </Link>
    </span>
  );
}
