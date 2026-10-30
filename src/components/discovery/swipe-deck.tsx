"use client";

import { Heart, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { recordDecision } from "@/app/(public)/discover/actions";
import { decisionForDrag, deckReducer, initDeck } from "@/lib/discovery/deck";
import { readGuestDecisions, writeGuestDecision } from "@/lib/discovery/guest-store";
import type { Decision, Listing } from "@/lib/discovery/types";
import { ListingCard } from "./listing-card";

type Source = "swipe" | "button" | "keyboard";

/**
 * Swipe deck (v2.0 §3): drag right to save, left to pass, or use the buttons / arrow keys.
 * Guests' decisions stay in this browser; signed-in users' decisions sync to their account.
 */
export function SwipeDeck({
  listings,
  signedIn,
  decidedIds,
}: {
  listings: Listing[];
  signedIn: boolean;
  /** Server-side decisions for signed-in users. Guests' come from browser storage. */
  decidedIds: string[];
}) {
  const ids = useMemo(() => listings.map((l) => l.id), [listings]);
  const byId = useMemo(() => new Map(listings.map((l) => [l.id, l])), [listings]);
  const [ready, setReady] = useState(signedIn);
  const [state, dispatch] = useReducer(deckReducer, undefined, () => initDeck(ids, new Set(decidedIds)));
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedThisVisit, setSavedThisVisit] = useState(0);
  const [, startTransition] = useTransition();

  // Guests: filter out what they've already decided on this device (after mount; storage is client-only).
  useEffect(() => {
    if (signedIn) return;
    const decided = new Set(Object.keys(readGuestDecisions()));
    dispatch({ type: "reset", ids: ids.filter((id) => !decided.has(id)) });
    setReady(true);
  }, [ids, signedIn]);

  const persist = useCallback(
    (id: string, action: Decision | "undo", source: Source | "button") => {
      if (!signedIn) {
        writeGuestDecision(id, action === "undo" ? null : action);
        return;
      }
      startTransition(async () => {
        const res = await recordDecision({ listingId: id, action, source });
        setError(res.ok ? null : res.error);
      });
    },
    [signedIn],
  );

  const top = state.queue[0] ? byId.get(state.queue[0]) : undefined;
  const next = state.queue[1] ? byId.get(state.queue[1]) : undefined;

  const decide = useCallback(
    (decision: Decision, source: Source) => {
      if (!top) return;
      dispatch({ type: "decide", decision });
      persist(top.id, decision, source);
      if (decision === "save") setSavedThisVisit((n) => n + 1);
      setAnnouncement(`${decision === "save" ? "Saved" : "Passed"}: ${top.headline}`);
    },
    [top, persist],
  );

  const undo = useCallback(() => {
    const last = state.history.at(-1);
    if (!last) return;
    dispatch({ type: "undo" });
    persist(last.id, "undo", "button");
    if (last.decision === "save") setSavedThisVisit((n) => Math.max(0, n - 1));
    setAnnouncement(`Undone: ${byId.get(last.id)?.headline ?? "last card"}`);
  }, [state.history, persist, byId]);

  // Pointer drag on the top card.
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("a,button,summary,details")) return;
    drag.current = { x: e.clientX, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) setDx(e.clientX - drag.current.x);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    const decision = decisionForDrag(e.clientX - drag.current.x);
    drag.current = null;
    setDx(0);
    if (decision) decide(decision, "swipe");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      decide("save", "keyboard");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      decide("pass", "keyboard");
    } else if (e.key === "Backspace" || e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
  };

  const remaining = state.queue.length;
  const hint = dx > 30 ? "save" : dx < -30 ? "pass" : null;

  return (
    <section aria-label="Swipe deck" className="mx-auto max-w-md">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
        <span>{ready ? `${remaining} to go` : "Loading…"}</span>
        <Link href="/saved" className="font-semibold text-brand-700 underline">
          Saved{savedThisVisit ? ` (+${savedThisVisit})` : ""}
        </Link>
      </div>

      <div
        tabIndex={0}
        role="group"
        aria-roledescription="card deck"
        aria-label="Use the left and right arrow keys to pass or save, Z to undo"
        onKeyDown={onKeyDown}
        className="relative min-h-[520px] rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4"
      >
        {!ready ? (
          <div className="h-[520px] animate-pulse rounded-3xl bg-sand-100" />
        ) : top ? (
          <>
            {next ? (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 scale-95 opacity-60">
                <ListingCard listing={next} />
              </div>
            ) : null}
            <div
              key={top.id}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                drag.current = null;
                setDx(0);
              }}
              style={{ transform: `translateX(${dx}px) rotate(${dx / 24}deg)`, touchAction: "pan-y" }}
              className={`relative cursor-grab select-none active:cursor-grabbing ${dx === 0 ? "motion-safe:transition-transform" : ""}`}
            >
              {hint ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-6 z-10 rounded-xl border-4 px-3 py-1 font-display text-2xl font-extrabold ${
                    hint === "save" ? "right-6 rotate-12 border-leaf-500 text-leaf-600" : "left-6 -rotate-12 border-red-500 text-red-600"
                  }`}
                  style={{ opacity: Math.min(1, Math.abs(dx) / 110) }}
                >
                  {hint === "save" ? "SAVE" : "PASS"}
                </span>
              ) : null}
              <ListingCard listing={top} detailHref={`/listings/${top.id}`} />
            </div>
          </>
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-sand-300 bg-white p-8 text-center">
            <p className="font-display text-xl font-bold">You&apos;re all caught up</p>
            <p className="text-sm text-slate-600">You&apos;ve seen every listing in this view.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/saved" className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-white">
                See saved
              </Link>
              <button
                type="button"
                onClick={() => dispatch({ type: "reset", ids })}
                className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-4 font-semibold"
              >
                Start again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => decide("pass", "button")}
          disabled={!top || !ready}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-40"
        >
          <X aria-hidden="true" className="h-7 w-7" />
          <span className="text-xs font-bold">Pass</span>
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={state.history.length === 0}
          className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-sand-300 bg-white text-slate-600 shadow-sm hover:bg-sand-100 disabled:opacity-40"
        >
          <RotateCcw aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">Undo</span>
        </button>
        <button
          type="button"
          onClick={() => decide("save", "button")}
          disabled={!top || !ready}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-leaf-200 bg-white text-leaf-600 shadow-sm transition hover:bg-leaf-50 disabled:opacity-40"
        >
          <Heart aria-hidden="true" className="h-7 w-7" />
          <span className="text-xs font-bold">Save</span>
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">Swipe the card, tap the buttons, or use ← and → keys.</p>
      {error ? (
        <p role="alert" className="mt-2 text-center text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {!signedIn ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Saves are kept on this device.{" "}
          <Link href="/sign-up" className="underline">
            Create a free account
          </Link>{" "}
          to sync them.
        </p>
      ) : null}
    </section>
  );
}
