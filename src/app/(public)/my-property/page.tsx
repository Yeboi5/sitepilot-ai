import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { FLAGS } from "@/lib/flags";

export const metadata: Metadata = { title: "My Property" };

export default function MyPropertyPage() {
  if (!FLAGS.myProperty) notFound();
  return (
    <ComingSoon
      title="My Property"
      points={[
        "A private space for the home you own: notes, maintenance and renovation ideas, saved concepts",
        "Claim your home with a private verification check. Claims stay pending until verified",
        "Choose whether buyers can send you an enquiry, and switch it off any time",
        "Value history where licensed data is available",
      ]}
    >
      <p>Everything you need to look after and improve your home, in one place.</p>
    </ComingSoon>
  );
}
