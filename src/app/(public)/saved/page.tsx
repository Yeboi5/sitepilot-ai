import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Saved properties" };

export default function SavedPage() {
  return (
    <ComingSoon
      title="Saved properties"
      points={["Home and Investment shortlists", "Each saved property opens its own workspace", "Couples Mode shares only what you choose"]}
    >
      <p>Your shortlists will live here, synced to your account.</p>
    </ComingSoon>
  );
}
