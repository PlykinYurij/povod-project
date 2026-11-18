import { parseCookie, stringifySetCookie } from "cookie";
import type { Request, Response } from "express";

export const SESSION_MAX_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const CSRF_SECONDS = 60 * 60;
export function cookieName(kind: "session" | "csrf"): string {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}povod-${kind}`;
}
export function readAuthCookie(
  request: Request,
  kind: "session" | "csrf",
): string | undefined {
  const value = parseCookie(request.headers.cookie ?? "")[cookieName(kind)];
  return value?.length === 64 && /^[a-f0-9]+$/.test(value) ? value : undefined;
}
export function writeAuthCookie(
  response: Response,
  kind: "session" | "csrf",
  value: string,
  maxAge: number,
): void {
  response.append(
    "Set-Cookie",
    stringifySetCookie({
      name: cookieName(kind),
      value,
      maxAge,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    }),
  );
}
