export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type IdParams = Promise<{ id: string }>;

export async function flash(sp: SearchParams) {
  const p = await sp;
  const one = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  return { error: one("error"), notice: one("notice"), get: one };
}
