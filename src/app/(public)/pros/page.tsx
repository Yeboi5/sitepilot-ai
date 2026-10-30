import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { FLAGS } from "@/lib/flags";

export const metadata: Metadata = { title: "Find a pro" };

export default function FindAProPage() {
  if (!FLAGS.findAPro) notFound();
  return (
    <ComingSoon
      title="Find a pro"
      points={["Licensed NSW conveyancers, verified manually during the pilot", "You choose what to share, and can revoke access at any time", "Any referral arrangements will be disclosed"]}
    >
      <p>Connecting you with licensed professionals is coming after a legal review of referral rules.</p>
    </ComingSoon>
  );
}
