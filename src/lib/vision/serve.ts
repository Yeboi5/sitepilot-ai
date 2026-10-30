import "server-only";

/** Vision images are re-encoded JPEGs we produced, so they're safe to show inline. */
export function imageResponse(body: Uint8Array | null, cache: "private" | "shared") {
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cache === "private" ? "private, max-age=300" : "private, max-age=60",
      "Referrer-Policy": "no-referrer",
    },
  });
}
