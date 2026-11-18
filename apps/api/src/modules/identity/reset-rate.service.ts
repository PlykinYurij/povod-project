import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { hashAuthToken } from "./auth-crypto";
import { AuthClock } from "./auth-clock";

@Injectable()
export class ResetRateService {
  constructor(private readonly database: DatabaseService, private readonly clock: AuthClock) {}

  async reserve(email: string, ip: string, response: Response, purpose = "reset-request"): Promise<void> {
    const now = this.clock.now();
    const deniedUntil = await this.database.getClient().$transaction(async tx => {
      // Stable order: IP then email. Blocked IPs cannot create unlimited email keys.
      let denied: Date | undefined;
      for (const [scope, value, limit, ttl] of [
        ["ip", ip, 10, 15 * 60_000],
        ["email", email, 3, 60 * 60_000],
      ] as const) {
        const key = hashAuthToken(JSON.stringify([purpose, scope, value]));
        const expiry = new Date(now.getTime() + ttl);
        const rows = await tx.$queryRaw<{ count: number; expiresAt: Date }[]>`
          INSERT INTO reset_rate_limits (key, count, expires_at) VALUES (${key}, 1, ${expiry})
          ON CONFLICT (key) DO UPDATE SET
            count = CASE WHEN reset_rate_limits.expires_at <= ${now} THEN 1 ELSE LEAST(reset_rate_limits.count + 1, ${limit + 1}) END,
            expires_at = CASE WHEN reset_rate_limits.expires_at <= ${now} THEN ${expiry} ELSE reset_rate_limits.expires_at END
          RETURNING count, expires_at AS "expiresAt"`;
        if (rows[0].count > limit && (!denied || denied < rows[0].expiresAt)) denied = rows[0].expiresAt;
        if (denied) break;
      }
      return denied;
    });
    if (deniedUntil) {
      response.setHeader("Retry-After", Math.max(1, Math.ceil((deniedUntil.getTime() - now.getTime()) / 1000)));
      throw new ApiError(429, "RATE_LIMITED", "Повторите запрос позже");
    }
  }
}
