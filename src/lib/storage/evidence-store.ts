import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "claim-evidence";

/**
 * Private storage for claim evidence. Production uses Supabase Storage (bucket `claim-evidence`,
 * RLS: own folder for uploads, verifiers read pending evidence) with the caller's session.
 *
 * STORAGE_DRIVER=local is for development and CI only, where the Storage service isn't running
 * (limitation L12): files go to a local folder, and access is checked by the database before any
 * read (the claim row must be visible to the caller through RLS).
 */
export interface EvidenceStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

function localStore(): EvidenceStore {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".local-storage", BUCKET);
  const resolve = (key: string) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("invalid storage key");
    return full;
  };
  return {
    async put(key, bytes) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(resolve(key)));
      } catch {
        return null;
      }
    },
    async remove(key) {
      await rm(resolve(key), { force: true });
    },
  };
}

function supabaseStore(supabase: Supabase): EvidenceStore {
  const bucket = () => supabase.storage.from(BUCKET);
  return {
    async put(key, bytes, contentType) {
      const { error } = await bucket().upload(key, bytes, { contentType, upsert: false });
      if (error) throw new Error("upload failed");
    },
    async get(key) {
      const { data } = await bucket().download(key);
      return data ? new Uint8Array(await data.arrayBuffer()) : null;
    },
    async remove(key) {
      await bucket().remove([key]);
    },
  };
}

export function evidenceStore(supabase: Supabase): EvidenceStore {
  if (process.env.STORAGE_DRIVER !== "local") return supabaseStore(supabase);
  // The local driver skips Storage RLS, so it must never run in a deployed environment.
  if (process.env.VERCEL_ENV) throw new Error("STORAGE_DRIVER=local is not allowed in deployed environments");
  return localStore();
}
