/**
 * Structured JSON logs (one line per event) for the hosting platform's log drain. Never log
 * document contents, prompts, tokens, passwords or full email addresses.
 */
type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function errorFields(e: unknown) {
  return e instanceof Error ? { error: e.name, message: e.message.slice(0, 300) } : { error: String(e).slice(0, 300) };
}
