import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { clamdScanner } from "@/lib/integrations/scanner";

const host = process.env.CLAMD_HOST ?? "127.0.0.1";
const port = Number(process.env.CLAMD_PORT ?? 3310);
const reachable = await new Promise<boolean>((res) => {
  const s = new Socket();
  s.setTimeout(1000, () => { s.destroy(); res(false); });
  s.once("error", () => res(false));
  s.connect(port, host, () => { s.end(); res(true); });
});

/** Real ClamAV daemon (e.g. `docker run -d -p 3310:3310 clamav/clamav:stable`). Skipped if none is running. */
describe.skipIf(!reachable)("ClamAV (clamd INSTREAM)", () => {
  const scanner = clamdScanner(host, port);
  it("detects the EICAR test file", async () => {
    const r = await scanner.scan(new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"));
    expect(r.clean).toBe(false);
    if (!r.clean) expect(r.signature).toMatch(/Eicar/i);
  });
  it("passes a clean PDF, including one larger than a single stream chunk", async () => {
    expect((await scanner.scan(new TextEncoder().encode("%PDF-1.4\n%%EOF"))).clean).toBe(true);
    const big = new Uint8Array(300 * 1024).fill(0x41);
    expect((await scanner.scan(big)).clean).toBe(true);
  });
  it("reports an unreachable daemon as an error (so uploads fail closed)", async () => {
    await expect(clamdScanner("127.0.0.1", 1).scan(new Uint8Array([1]))).rejects.toThrow();
  });
});
