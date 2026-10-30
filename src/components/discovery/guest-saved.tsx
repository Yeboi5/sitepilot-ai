"use client";

import { useEffect, useState, useTransition } from "react";
import { getListings, importGuestSaves } from "@/app/(public)/discover/actions";
import { clearGuestDecisions, readGuestDecisions, savedIds, writeGuestDecision } from "@/lib/discovery/guest-store";
import type { Kind, Listing } from "@/lib/discovery/types";
import { SavedList } from "./saved-list";

/** Guest: shows saves kept in this browser. */
export function GuestSaved({ kind }: { kind: Kind }) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  useEffect(() => {
    void getListings(savedIds(readGuestDecisions())).then(setListings);
  }, []);
  if (listings === null) return <div className="h-32 animate-pulse rounded-2xl bg-sand-100" />;
  const shown = listings.filter((l) => l.kind === kind);
  if (shown.length === 0) return <EmptySaved kind={kind} />;
  return (
    <SavedList
      listings={shown}
      onRemove={(id) => {
        writeGuestDecision(id, null);
        setListings((all) => (all ?? []).filter((x) => x.id !== id));
      }}
    />
  );
}

/** Signed-in user who saved things as a guest on this device: offer to bring them across. */
export function ImportGuestSaves() {
  const [ids, setIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setIds(savedIds(readGuestDecisions())), []);
  if (ids.length === 0 && !message) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
      {message ?? `You saved ${ids.length} ${ids.length === 1 ? "property" : "properties"} on this device before signing in.`}
      {!message ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await importGuestSaves(ids);
              if (res.ok) {
                clearGuestDecisions();
                setIds([]);
                setMessage(`Added ${res.imported ?? 0} to your account.`);
              } else setMessage(res.error);
            })
          }
          className="min-h-11 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700"
        >
          Add to my account
        </button>
      ) : null}
    </div>
  );
}

export function EmptySaved({ kind }: { kind: Kind }) {
  return (
    <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center text-slate-600">
      Nothing saved here yet.{" "}
      <a href={`/discover/${kind}`} className="font-semibold text-brand-700 underline">
        Start swiping
      </a>
    </div>
  );
}
