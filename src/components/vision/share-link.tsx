"use client";

import { useEffect, useState } from "react";

export function ShareLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input readOnly value={url} aria-label="Share link" data-testid="share-link" onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-xl border border-sand-300 bg-white px-3 font-mono text-xs" />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 bg-white px-3 text-sm font-semibold hover:bg-sand-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
