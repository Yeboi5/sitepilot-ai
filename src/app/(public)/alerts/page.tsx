import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { FLAGS } from "@/lib/flags";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  if (!FLAGS.alerts) notFound();
  return (
    <ComingSoon title="Alerts" points={["New listings that match your saved preferences", "Changes on properties you're watching", "Deadlines on your matters"]}>
      <p>Alerts are on the way. You&apos;ll choose exactly what you hear about.</p>
    </ComingSoon>
  );
}
