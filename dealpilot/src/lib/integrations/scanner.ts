import { Socket } from "node:net";

export type ScanResult = { clean: true; engine: string } | { clean: false; engine: string; signature: string };

export interface Scanner {
  readonly name: string;
  /** True for a real antivirus engine; false for the built-in baseline checks. */
  readonly antivirus: boolean;
  scan(data: Uint8Array): Promise<ScanResult>;
}

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/**
 * Baseline checks that need no external service: the EICAR test signature, executable headers
 * and PDFs with auto-run actions. NOT a substitute for antivirus — production uses ClamAV.
 */
export const builtinScanner: Scanner = {
  name: "builtin-baseline",
  antivirus: false,
  async scan(data) {
    const head = Buffer.from(data.subarray(0, 4));
    if (head[0] === 0x4d && head[1] === 0x5a) return { clean: false, engine: this.name, signature: "Windows executable header" };
    if (head.toString("latin1") === "\x7fELF") return { clean: false, engine: this.name, signature: "ELF executable header" };
    const text = Buffer.from(data.subarray(0, 2 * 1024 * 1024)).toString("latin1");
    if (text.includes(EICAR)) return { clean: false, engine: this.name, signature: "EICAR-Test-File" };
    if (text.startsWith("%PDF") && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(text)) return { clean: false, engine: this.name, signature: "PDF with active content" };
    return { clean: true, engine: this.name };
  },
};

/**
 * ClamAV daemon over TCP using the INSTREAM protocol
 * (zINSTREAM\0, then <uint32 length><chunk>... and a zero-length terminator).
 */
export function clamdScanner(host: string, port = 3310, timeoutMs = 30_000): Scanner {
  return {
    name: `clamav@${host}:${port}`,
    antivirus: true,
    scan(data) {
      return new Promise<ScanResult>((resolve, reject) => {
        const sock = new Socket();
        let reply = "";
        sock.setTimeout(timeoutMs, () => { sock.destroy(); reject(new Error("ClamAV timed out")); });
        sock.on("error", reject);
        sock.on("data", (d) => { reply += d.toString(); });
        sock.on("end", () => {
          const r = reply.replace(/\0/g, "").trim();
          if (/: OK$/.test(r)) resolve({ clean: true, engine: this.name });
          else if (/FOUND$/.test(r)) resolve({ clean: false, engine: this.name, signature: r.replace(/^stream:\s*/, "").replace(/\s*FOUND$/, "") });
          else reject(new Error(`ClamAV error: ${r || "no reply"}`));
        });
        sock.connect(port, host, () => {
          sock.write("zINSTREAM\0");
          const CHUNK = 64 * 1024;
          for (let i = 0; i < data.length; i += CHUNK) {
            const part = data.subarray(i, i + CHUNK);
            const len = Buffer.alloc(4);
            len.writeUInt32BE(part.length);
            sock.write(len);
            sock.write(part);
          }
          sock.write(Buffer.alloc(4));
        });
      });
    },
  };
}
