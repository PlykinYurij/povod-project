import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { DatabaseService } from "../../database/database.service";
import { hashAuthToken } from "./auth-crypto";
import { ApiError } from "../../http/api-error";
import { AuthClock } from "./auth-clock";

@Injectable()
export class LoginAttemptsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: AuthClock,
  ) {}
  async reserve(
    email: string,
    ip: string,
    response: Response,
  ): Promise<{ key: string; expiresAt: Date }> {
    const db = this.database.getClient();
    const key = hashAuthToken(JSON.stringify([email, ip]));
    const now = this.clock.now();
    const expiry = new Date(now.getTime() + 15 * 60 * 1000);
    await db.loginAttempt.deleteMany({ where: { expiresAt: { lte: now } } });
    const rows = await db.$queryRaw<{ expiresAt: Date }[]>`
      INSERT INTO login_attempts (key, count, expires_at) VALUES (${key}, 1, ${expiry})
      ON CONFLICT (key) DO UPDATE SET count = login_attempts.count + 1
      WHERE login_attempts.count < 5 RETURNING expires_at AS "expiresAt"`;
    if (!rows[0]) {
      const existing = await db.loginAttempt.findUnique({ where: { key } });
      response.setHeader(
        "Retry-After",
        String(
          Math.max(
            1,
            Math.ceil(
              ((existing?.expiresAt.getTime() ?? expiry.getTime()) -
                now.getTime()) /
                1000,
            ),
          ),
        ),
      );
      throw new ApiError(429, "RATE_LIMITED", "Повторите вход позже");
    }
    return { key, expiresAt: rows[0].expiresAt };
  }
  async release(key: string, expiresAt: Date): Promise<void> {
    await this.database.getClient().$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { count: number }[]
      >`SELECT count FROM login_attempts
        WHERE key = ${key} AND expires_at = ${expiresAt} FOR UPDATE`;
      if (!rows[0]) return;
      if (rows[0].count === 1)
        await tx.loginAttempt.deleteMany({ where: { key, expiresAt } });
      else
        await tx.loginAttempt.updateMany({
          where: { key, expiresAt },
          data: { count: { decrement: 1 } },
        });
    });
  }
}
