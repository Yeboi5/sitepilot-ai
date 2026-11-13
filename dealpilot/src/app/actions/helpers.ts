import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMoney } from "@/lib/domain/money";
import { InvalidTransitionError } from "@/lib/domain/negotiation";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/domain/permissions";

export function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function money(fd: FormData, name: string, label = "amount"): number {
  const cents = parseMoney(str(fd, name));
  if (cents === null || cents < 0) throw new ValidationError(`Enter a valid ${label}`);
  return cents;
}

export function optionalMoney(fd: FormData, name: string): number | undefined {
  const raw = str(fd, name);
  if (!raw) return undefined;
  const c = parseMoney(raw);
  if (c === null || c < 0) throw new ValidationError(`Enter a valid ${name}`);
  return c;
}

export function int(fd: FormData, name: string, fallback = 0): number {
  const raw = str(fd, name);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new ValidationError(`${name} must be a whole number`);
  return n;
}

export function withParam(path: string, key: string, value: string) {
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${key}=${encodeURIComponent(value.slice(0, 300))}${hash ? `#${hash}` : ""}`;
}

function userMessage(e: unknown): string {
  if (e instanceof ValidationError || e instanceof ForbiddenError || e instanceof NotFoundError || e instanceof InvalidTransitionError) return e.message;
  console.error("[action] unexpected error", e);
  return "Something went wrong. Please try again.";
}

/**
 * Runs a mutation, then redirects. Expected errors become a friendly message
 * on `errorPath`; unexpected ones are logged server-side and shown generically.
 */
export async function act<T>(fn: () => Promise<T>, success: (r: T) => string, errorPath: string, notice?: string): Promise<never> {
  let dest: string;
  try {
    const r = await fn();
    dest = success(r);
    if (notice) dest = withParam(dest, "notice", notice);
  } catch (e) {
    dest = withParam(errorPath, "error", userMessage(e));
  }
  revalidatePath("/", "layout");
  redirect(dest);
}
