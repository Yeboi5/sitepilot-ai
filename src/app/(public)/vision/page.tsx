import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { FLAGS } from "@/lib/flags";

export const metadata: Metadata = { title: "SitePilot Vision" };

export default function VisionPage() {
  if (!FLAGS.vision) notFound();
  return (
    <ComingSoon
      title="SitePilot Vision"
      points={[
        "Upload your own photo: from above, the street, or inside",
        "Try a pool, granny flat, new facade, kitchen and more, then compare before and after",
        "Every image is marked AI CONCEPT. It's an idea, not a plan or an approval",
        "Private by default. Share only if you choose",
      ]}
    >
      <p>See what a property could become, from a photo you&apos;re allowed to use.</p>
    </ComingSoon>
  );
}
