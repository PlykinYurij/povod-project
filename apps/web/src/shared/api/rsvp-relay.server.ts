import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { getSubmitPublicRsvpUrl } from "@shared/api/server";
import { trustedApiOrigin } from "@shared/api/api-origin";
import { publicationSurface } from "@shared/config/publication-host";
import { isProjectId } from "@shared/config/project-navigation";

const MAX_RSVP_BYTES = 4096;
const cache = { "Cache-Control": "no-store" };
const errors = {
  403: "RSVP_ORIGIN_REJECTED",
  404: "INVITATION_UNAVAILABLE",
  413: "BODY_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_FAILED",
  503: "SERVICE_UNAVAILABLE",
} as const;

function failure(status: keyof typeof errors) {
  return Response.json(
    { error: { code: errors[status], requestId: randomUUID() } },
    { status, headers: cache },
  );
}

export async function relayGuestRsvp(request: Request): Promise<Response> {
  const host = request.headers.get("host") ?? "";
  const surface = publicationSurface(host);
  if (surface.kind !== "guest") return failure(404);

  const local =
    process.env.POVOD_RSVP_LOCAL_HTTP === "1" &&
    surface.hostname.endsWith(".test") &&
    request.headers.get("origin") === new URL(`http://${host}`).origin;
  if (
    !local &&
    request.headers.get("origin") !== new URL(`https://${host}`).origin
  )
    return failure(403);

  if (new URL(request.url).search) return failure(422);
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    return failure(415);
  const key = request.headers.get("idempotency-key");
  if (!key || !isProjectId(key)) return failure(422);

  const headers = new Headers({
    "Content-Type": "application/json",
    "Idempotency-Key": key,
  });
  try {
    const api = new URL(trustedApiOrigin(true));
    if (local) {
      if (api.hostname !== "127.0.0.1" && api.hostname !== "localhost")
        return failure(503);
    } else {
      const secret = process.env.RSVP_RELAY_SECRET;
      const ip = request.headers.get("x-povod-rsvp-client-ip");
      // The ingress overwrites this header and is the only public entry to Next.
      if (!secret || !/^[a-f0-9]{64}$/.test(secret) || !ip || !isIP(ip))
        return failure(503);
      headers.set("X-Povod-Rsvp-Relay", secret);
      headers.set("X-Povod-Rsvp-Client-IP", ip);
    }
    const body = await readBoundedBody(request);
    if (body === null) return failure(413);
    const result = await fetch(
      new URL(getSubmitPublicRsvpUrl(surface.slug), api),
      {
        method: "POST",
        headers,
        body,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!result.headers.get("content-type")?.startsWith("application/json")) {
      void result.body?.cancel();
      return failure(503);
    }
    const responseHeaders = new Headers({
      ...cache,
      "Content-Type": "application/json",
    });
    const retry = result.headers.get("retry-after");
    if (retry && /^\d+$/.test(retry)) responseHeaders.set("Retry-After", retry);
    return new Response(result.body, {
      status: result.status,
      headers: responseHeaders,
    });
  } catch {
    return failure(503);
  }
}

async function readBoundedBody(request: Request): Promise<ArrayBuffer | null> {
  const buffer = new Uint8Array(MAX_RSVP_BYTES);
  const reader = request.body?.getReader();
  if (!reader) return buffer.buffer.slice(0, 0);
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return buffer.buffer.slice(0, bytes);
      if (bytes + value.byteLength > MAX_RSVP_BYTES) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      buffer.set(value, bytes);
      bytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}
