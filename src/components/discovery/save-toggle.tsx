"use client";

import { Heart } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { recordDecision } from "@/app/(public)/discover/actions";
import { readGuestDecisions, writeGuestDecision } from "@/lib/discovery/guest-store";

/** Save / unsave a listing from its detail page or the saved list (guest or signed in). */
export function SaveToggle({ listingId, signedIn, initiallySaved }: { listingId: string; signedIn: boolean; initiallySaved: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!signedIn) setSaved(readGuestDecisions()[listingId] === "save");
  }, [listingId, signedIn]);

  const toggle = () => {
    const next = !saved;
    setSaved(next);
    if (!signedIn) {
      writeGuestDecision(listingId, next ? "save" : null);
      return;
    }
    startTransition(async () => {
      const res = await recordDecision({ listingId, action: next ? "save" : "unsave", source: "list" });
      if (!res.ok) {
        setSaved(!next);
        setError(res.error);
      } else setError(null);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold transition ${
          saved ? "bg-leaf-600 text-white hover:bg-leaf-700" : "border border-sand-300 bg-white text-slate-800 hover:bg-sand-100"
        }`}
      >
        <Heart aria-hidden="true" className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
        {saved ? "Saved" : "Save"}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
