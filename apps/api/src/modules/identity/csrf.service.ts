import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { ApiError } from "../../http/api-error";
import { randomAuthToken } from "./auth-crypto";
import { CSRF_SECONDS, readAuthCookie, writeAuthCookie } from "./auth-cookies";
import { webOrigin } from "../../http/web-origin";
import { AuthClock } from "./auth-clock";

@Injectable()
export class CsrfService {
  constructor(private readonly clock: AuthClock) {}
  private readonly localSecret = randomAuthToken();
  private key(): string {
    const configured = process.env.CSRF_SECRET;
    if (configured && configured.length >= 64 && !/[^a-f0-9]/i.test(configured))
      return configured;
    if (configured || process.env.NODE_ENV === "production")
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Защита запросов не настроена",
      );
    return this.localSecret;
  }
  private signature(context: string, session: string, expires: string): string {
    return createHmac("sha256", this.key())
      .update(JSON.stringify([context, session, expires]))
      .digest("hex");
  }
  issue(
    request: Request,
    response: Response,
  ): { csrfToken: string; expiresAt: string } {
    if (
      (request.get("origin") && request.get("origin") !== webOrigin()) ||
      request.get("sec-fetch-site") === "cross-site"
    )
      throw new ApiError(403, "CSRF_FAILED", "Недопустимый источник запроса");
    const context = readAuthCookie(request, "csrf") ?? randomAuthToken();
    const expires = String(this.clock.now().getTime() + CSRF_SECONDS * 1000);
    const token = `${expires}.${this.signature(context, readAuthCookie(request, "session") ?? "", expires)}`;
    writeAuthCookie(response, "csrf", context, CSRF_SECONDS);
    return {
      csrfToken: token,
      expiresAt: new Date(Number(expires)).toISOString(),
    };
  }
  verify(request: Request): void {
    const context = readAuthCookie(request, "csrf");
    const supplied = request.get("X-CSRF-Token") ?? "";
    const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(supplied);
    const now = this.clock.now().getTime();
    if (
      !context ||
      !match ||
      Number(match[1]) <= now ||
      Number(match[1]) > now + CSRF_SECONDS * 1000
    ) {
      throw new ApiError(403, "CSRF_FAILED", "Обновите защиту запроса");
    }
    const expected = this.signature(
      context,
      readAuthCookie(request, "session") ?? "",
      match[1],
    );
    if (
      !timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(match[2], "hex"),
      )
    )
      throw new ApiError(403, "CSRF_FAILED", "Недопустимый защитный токен");
  }
}
