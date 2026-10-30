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
      points={["Conveyancers and property lawyers in every state and territory, each licence checked against that state's register", "You choose what to share, and can revoke access at any time", "Any referral arrangements will be disclosed"]}
    >
      <p>Connecting you with licensed professionals, wherever the property is.</p>
    </ComingSoon>
  );
}
