/**
 * ABN Lookup (Australian Business Register) JSON service.
 * https://abr.business.gov.au/Tools/WebServices — free, needs a registration GUID (ABR_GUID).
 * Returns JSONP: `callback({...})`. Errors come back in `Message` with HTTP 200.
 */
export type AbrResult =
  | { ok: true; status: "active" | "cancelled"; abn: string; entityName: string; businessNames: string[]; gstRegistered: boolean }
  | { ok: false; reason: "not_found" | "not_configured" | "service_error"; message: string };

interface AbrPayload {
  Abn: string;
  AbnStatus: string;
  EntityName: string;
  BusinessName?: string[];
  Gst?: string | null;
  Message: string;
}

export function parseAbrResponse(body: string): AbrResult {
  const m = body.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
  let p: AbrPayload;
  try {
    p = JSON.parse(m ? m[1] : body) as AbrPayload;
  } catch {
    return { ok: false, reason: "service_error", message: "Unreadable response from ABN Lookup" };
  }
  if (p.Message) {
    if (/not recognised as a Registered Party|guid/i.test(p.Message)) return { ok: false, reason: "not_configured", message: p.Message };
    return { ok: false, reason: /no record|not.*valid|not found/i.test(p.Message) ? "not_found" : "service_error", message: p.Message };
  }
  if (!p.Abn) return { ok: false, reason: "not_found", message: "ABN not found" };
  return {
    ok: true,
    status: /active/i.test(p.AbnStatus) ? "active" : "cancelled",
    abn: p.Abn,
    entityName: p.EntityName,
    businessNames: p.BusinessName ?? [],
    gstRegistered: !!p.Gst,
  };
}

export interface AbrClient {
  readonly configured: boolean;
  lookup(abn: string): Promise<AbrResult>;
}

export function abrClient(guid = process.env.ABR_GUID, fetchImpl: typeof fetch = fetch): AbrClient {
  return {
    configured: !!guid,
    async lookup(abn: string) {
      if (!guid) return { ok: false, reason: "not_configured", message: "ABN Lookup is not configured (ABR_GUID)" };
      try {
        const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${encodeURIComponent(abn)}&guid=${encodeURIComponent(guid)}`;
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return { ok: false, reason: "service_error", message: `ABN Lookup returned ${res.status}` };
        return parseAbrResponse(await res.text());
      } catch (e) {
        return { ok: false, reason: "service_error", message: e instanceof Error ? e.message : "ABN Lookup failed" };
      }
    },
  };
}
