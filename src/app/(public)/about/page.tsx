import type { Metadata } from "next";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = { title: "About" };

const pillars = [
  {
    title: "For investors",
    body: "Create a property workspace, keep an evidence register of official planning documents with retrieval dates, and compare development scenarios.",
  },
  {
    title: "For conveyancers",
    body: "Accept client invitations, verify AI-flagged contract and title issues against their source pages, and manage tasks and milestones.",
  },
  {
    title: "Connected",
    body: "Professionally confirmed findings flow back into feasibility, with provenance and sign-off, never silently.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="py-10 sm:py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Australia-wide · pilot</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Property feasibility and conveyancing, in one secure workspace.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          SitePilot AI helps small developers and investors test a site and work with a licensed conveyancer, with every
          fact sourced, every assumption labelled and every AI flag reviewed by a professional.
        </p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/sign-up">Create a free workspace</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Explore the dashboard
          </ButtonLink>
        </div>
      </section>
      <section className="grid gap-4 pb-10 md:grid-cols-3">
        {pillars.map((p) => (
          <Card key={p.title}>
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{p.body}</p>
          </Card>
        ))}
      </section>
    </>
  );
}
