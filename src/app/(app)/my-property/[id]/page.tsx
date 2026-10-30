import { CheckCircle2, Clock, ImageIcon, LineChart, MessageSquare, ShieldCheck, Wand2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { deleteNote, removeHome, respondToEnquiry, setEnquiries, toggleMaintenance, withdrawClaim } from "@/app/(app)/my-property/actions";
import { MaintenanceForm, NoteForm } from "@/components/my-property/forms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { localDate } from "@/lib/dates";
import { FLAGS } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { timeZoneFor, type State } from "@/lib/jurisdictions";
import { IDEAS_DISCLAIMER, MAINTENANCE_IDEAS, RENOVATION_IDEAS } from "@/lib/my-property/ideas";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Property" };

const smallButton = "inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-3 text-sm font-semibold hover:bg-sand-100";

export default async function HomePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ claim?: string }> }) {
  if (!FLAGS.myProperty) notFound();
  const { id } = await params;
  const { claim: claimFlash } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await requireOrg();
  const supabase = await createClient();

  const { data: home } = await supabase
    .from("owned_properties")
    .select("id, user_id, nickname, address, suburb, state, postcode, accepts_enquiries")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!home) notFound();

  const [{ data: claims }, { data: notes }, { data: tasks }, { data: enquiries }, { data: concepts }] = await Promise.all([
    supabase.from("homeowner_claims").select("id, status, created_at, decided_at, decision_note").eq("owned_property_id", id).order("created_at", { ascending: false }),
    supabase.from("property_notes").select("id, body, created_at").eq("owned_property_id", id).order("created_at", { ascending: false }),
    supabase.from("maintenance_items").select("id, title, due_on, done_at").eq("owned_property_id", id).order("done_at", { nullsFirst: true }).order("due_on"),
    supabase.from("buyer_enquiries").select("id, message, status, owner_reply, created_at").eq("owned_property_id", id).order("created_at", { ascending: false }),
    FLAGS.vision
      ? supabase.from("visual_projects").select("id, title").eq("owned_property_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const latest = claims?.[0];
  const verified = (claims ?? []).some((c) => c.status === "verified");
  const today = localDate(timeZoneFor(home.state as State, home.postcode));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm">
        <Link href="/my-property" className="text-brand-700 underline">
          ← My Property
        </Link>
      </p>
      <PageHeader title={home.nickname ?? home.address} description={`${home.address}, ${home.suburb} ${home.state} ${home.postcode}`} />
      {claimFlash === "submitted" ? <Alert>Thanks. Your claim is pending review. We&apos;ll update this page when it&apos;s decided.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-brand-600" /> Ownership
          </h2>
          {verified ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-leaf-700">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Verified owner
            </p>
          ) : latest?.status === "pending" ? (
            <div className="mt-2 space-y-2 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                <Clock aria-hidden="true" className="h-4 w-4" /> Claim pending review
              </p>
              <p className="text-slate-600">Submitted {formatDate(latest.created_at)}. Your document is only seen by a reviewer.</p>
              <form action={withdrawClaim}>
                <input type="hidden" name="ownedId" value={home.id} />
                <input type="hidden" name="claimId" value={latest.id} />
                <button type="submit" className={smallButton}>
                  Withdraw claim
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              {latest?.status === "rejected" ? (
                <p className="flex items-start gap-1.5 text-red-800">
                  <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> Your last claim wasn&apos;t verified
                  {latest.decision_note ? `: ${latest.decision_note}` : "."}
                </p>
              ) : (
                <p className="text-slate-600">Not claimed. Adding a home doesn&apos;t make you its verified owner.</p>
              )}
              {FLAGS.homeownerClaims ? (
                <Link href={`/my-property/${home.id}/claim`} className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-3 font-semibold text-white hover:bg-brand-700">
                  Claim this home
                </Link>
              ) : null}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <LineChart aria-hidden="true" className="h-5 w-5 text-brand-600" /> Value history
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Not available. We don&apos;t have licensed valuation data yet, so we won&apos;t show an estimate.
          </p>
        </Card>
      </div>

      {FLAGS.buyerEnquiries ? (
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare aria-hidden="true" className="h-5 w-5 text-brand-600" /> Buyer enquiries
          </h2>
          {!verified ? (
            <p className="mt-2 text-sm text-slate-600">Available once your ownership is verified.</p>
          ) : (
            <div className="mt-2 space-y-4 text-sm">
              <form action={setEnquiries} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sand-50 p-3">
                <input type="hidden" name="ownedId" value={home.id} />
                <input type="hidden" name="on" value={home.accepts_enquiries ? "false" : "true"} />
                <span>
                  {home.accepts_enquiries
                    ? "On: buyers browsing off-market homes can send you a message through SitePilot."
                    : "Off: buyers can't contact you about this home."}{" "}
                  Your name and contact details are never shown.
                </span>
                <button type="submit" className={smallButton}>
                  {home.accepts_enquiries ? "Turn off" : "Turn on"}
                </button>
              </form>
              {(enquiries ?? []).length === 0 ? (
                <p className="text-slate-600">No enquiries yet.</p>
              ) : (
                <ul className="space-y-3">
                  {(enquiries ?? []).map((e) => (
                    <li key={e.id} className="space-y-2 rounded-2xl border border-sand-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">A SitePilot member · {formatDate(e.created_at)}</span>
                        <Badge tone={e.status === "open" ? "info" : e.status === "replied" ? "success" : "neutral"}>{e.status}</Badge>
                      </div>
                      <p>{e.message}</p>
                      {e.owner_reply ? <p className="rounded-xl bg-leaf-50 p-2 text-slate-700">You replied: {e.owner_reply}</p> : null}
                      {e.status === "open" || e.status === "replied" ? (
                        <form action={respondToEnquiry} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="ownedId" value={home.id} />
                          <input type="hidden" name="enquiryId" value={e.id} />
                          <label className="min-w-[12rem] flex-1">
                            <span className="sr-only">Reply</span>
                            <input name="reply" maxLength={1000} placeholder="Reply through SitePilot" className="block min-h-11 w-full rounded-xl border border-sand-300 px-3" />
                          </label>
                          <button name="action" value="reply" className={smallButton}>
                            Reply
                          </button>
                          <button name="action" value="decline" className={smallButton}>
                            Not interested
                          </button>
                          <button name="action" value="close" className={smallButton}>
                            Close
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold">Maintenance checklist</h2>
        <ul className="my-3 divide-y divide-sand-100">
          {(tasks ?? []).map((t) => (
            <li key={t.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
              <span className={t.done_at ? "text-slate-500 line-through" : ""}>
                {t.title}
                {t.due_on && !t.done_at ? <span className="ml-2 text-xs text-slate-500">due {formatDate(t.due_on)}</span> : null}
              </span>
              <form action={toggleMaintenance}>
                <input type="hidden" name="ownedId" value={home.id} />
                <input type="hidden" name="itemId" value={t.id} />
                <input type="hidden" name="done" value={t.done_at ? "false" : "true"} />
                <button type="submit" className={smallButton}>
                  {t.done_at ? "Undo" : "Done"}
                  <span className="sr-only"> {t.title}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
        <MaintenanceForm ownedId={home.id} today={today} />
      </Card>

      <Card>
        <h2 className="font-semibold">Ideas</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[
            ["Maintenance", MAINTENANCE_IDEAS],
            ["Renovation", RENOVATION_IDEAS],
          ].map(([label, ideas]) => (
            <div key={label as string}>
              <h3 className="text-sm font-semibold text-slate-700">{label as string}</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {(ideas as typeof MAINTENANCE_IDEAS).map((i) => (
                  <li key={i.title}>
                    <span className="font-medium">{i.title}.</span> <span className="text-slate-600">{i.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">{IDEAS_DISCLAIMER}</p>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <ImageIcon aria-hidden="true" className="h-5 w-5 text-brand-600" /> Saved concepts
        </h2>
        {(concepts ?? []).length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {(concepts ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/vision/${c.id}`} className="font-semibold text-brand-700 underline">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Concepts you create in SitePilot Vision for this home will appear here.</p>
        )}
        {FLAGS.vision ? (
          <Link href={`/vision/new?home=${home.id}`} className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 underline">
            <Wand2 aria-hidden="true" className="h-4 w-4" /> New concept for this home
          </Link>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-semibold">Notes</h2>
        <div className="mt-3">
          <NoteForm ownedId={home.id} />
        </div>
        <ul className="mt-4 space-y-3">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="rounded-2xl bg-sand-50 p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{formatDate(n.created_at)}</span>
                <form action={deleteNote}>
                  <input type="hidden" name="ownedId" value={home.id} />
                  <input type="hidden" name="itemId" value={n.id} />
                  <button type="submit" className="min-h-11 px-2 underline">
                    Delete note
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <details className="text-sm">
        <summary className="cursor-pointer text-red-700 underline">Remove this home from My Property</summary>
        <form action={removeHome} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="ownedId" value={home.id} />
          <span className="text-slate-700">Deletes your notes, checklist, claims, evidence and enquiries for this home.</span>
          <button type="submit" className="min-h-11 rounded-xl bg-red-700 px-3 font-semibold text-white">
            Remove permanently
          </button>
        </form>
      </details>
    </div>
  );
}
