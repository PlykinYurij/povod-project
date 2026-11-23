import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import { ApiError } from "../../http/api-error";

export function rsvpClientIp(request: Request): string {
  const proof = request.get("x-povod-rsvp-relay");
  const clientIp = request.get("x-povod-rsvp-client-ip");
  if (process.env.NODE_ENV !== "production" && !proof && !clientIp)
    return request.ip ?? request.socket.remoteAddress ?? "unknown";

  const secret = process.env.RSVP_RELAY_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret))
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Маршрут ответа не настроен",
    );
  if (
    !proof ||
    !/^[a-f0-9]{64}$/.test(proof) ||
    !clientIp ||
    !isIP(clientIp) ||
    !timingSafeEqual(Buffer.from(proof, "hex"), Buffer.from(secret, "hex"))
  )
    throw new ApiError(
      403,
      "RSVP_RELAY_REQUIRED",
      "Ответ должен быть отправлен с приглашения",
    );
  return clientIp;
}
