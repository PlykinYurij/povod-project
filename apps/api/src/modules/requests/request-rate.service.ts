import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../database/generated/client";
import { RequestClock } from "./request-clock";
import { requestRateKey, requestRateSecret } from "./request-digests";

@Injectable()
export class RequestRateService implements OnModuleInit, OnModuleDestroy {
  private secret?: Buffer;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: RequestClock,
  ) {}

  async reserve(
    tx: Prisma.TransactionClient,
    ip: string,
    phone: string,
    now: Date,
  ): Promise<Date | undefined> {
    // Misconfigured public submissions fail closed without disabling unrelated APIs/liveness.
    const secret = (this.secret ??= requestRateSecret());
    // Stable order IP -> phone; a blocked IP cannot create unlimited phone keys.
    for (const [scope, value, limit, ttl] of [
      ["ip", ip, 10, 15 * 60_000],
      ["phone", phone, 3, 60 * 60_000],
    ] as const) {
      const key = requestRateKey(secret, scope, value);
      const expires = new Date(now.getTime() + ttl);
      const rows = await tx.$queryRaw<{ count: number; expiresAt: Date }[]>`
        INSERT INTO service_request_rate_limits (key, count, expires_at) VALUES (${key}, 1, ${expires})
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN service_request_rate_limits.expires_at <= ${now} THEN 1 ELSE LEAST(service_request_rate_limits.count + 1, ${limit + 1}) END,
          expires_at = CASE WHEN service_request_rate_limits.expires_at <= ${now} THEN ${expires} ELSE service_request_rate_limits.expires_at END
        RETURNING count, expires_at AS "expiresAt"`;
      if (rows[0].count > limit) return rows[0].expiresAt;
    }
    return undefined;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      if (process.env.DATABASE_URL) void this.cleanup().catch(() => undefined);
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async cleanup(): Promise<void> {
    await this.database.getClient().$executeRaw`
      DELETE FROM service_request_rate_limits WHERE key IN (
        SELECT key FROM service_request_rate_limits WHERE expires_at <= ${this.clock.now()}
        ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED
      )`;
  }
}
