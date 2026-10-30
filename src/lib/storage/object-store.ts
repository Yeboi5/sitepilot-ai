import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Bucket = "claim-evidence" | "vision-sources" | "vision-outputs";

/**
 * Private object storage. Production uses Supabase Storage with the caller's session, so storage
 * RLS applies (own folder `<user_id>/…`; verifiers read pending claim evidence; shared Vision
 * outputs by name).
 *
 * STORAGE_DRIVER=local is for development and CI only, where the Storage service isn't running
 * (limitation L12): files go to a local folder, and every read is preceded by a database check
 * (the owning row must be visible to the caller through RLS, or an RPC must allow it).
 */
export interface ObjectStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

function localStore(bucket: Bucket): ObjectStore {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".local-storage", bucket);
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

function supabaseStore(supabase: Supabase, name: Bucket): ObjectStore {
  const bucket = () => supabase.storage.from(name);
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

export function objectStore(supabase: Supabase, bucket: Bucket): ObjectStore {
  if (process.env.STORAGE_DRIVER !== "local") return supabaseStore(supabase, bucket);
  // The local driver skips Storage RLS, so it must never run in a deployed environment.
  if (process.env.VERCEL_ENV) throw new Error("STORAGE_DRIVER=local is not allowed in deployed environments");
  return localStore(bucket);
}

export const evidenceStore = (supabase: Supabase) => objectStore(supabase, "claim-evidence");
