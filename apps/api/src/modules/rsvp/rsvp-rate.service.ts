import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../database/generated/client";

const LIMIT = 30;
const WINDOW_MS = 15 * 60_000;

@Injectable()
export class RsvpRateService implements OnModuleInit, OnModuleDestroy {
  private secret?: Buffer;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly database: DatabaseService) {}

  async reserve(
    tx: Prisma.TransactionClient,
    publicationId: string,
    ip: string,
  ) {
    const secret = (this.secret ??= readRateSecret());
    const clientKey = createHmac("sha256", secret)
      .update(JSON.stringify(["rsvp-v1", publicationId, ip]))
      .digest("hex");
    const now = new Date();
    const expires = new Date(now.getTime() + WINDOW_MS);
    const [counter] = await tx.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO rsvp_rate_limits (publication_id, client_key, count, expires_at)
      VALUES (${publicationId}::uuid, ${clientKey}, 1, ${expires})
      ON CONFLICT (publication_id, client_key) DO UPDATE SET
        count = CASE WHEN rsvp_rate_limits.expires_at <= ${now} THEN 1
          ELSE LEAST(rsvp_rate_limits.count + 1, ${LIMIT + 1}) END,
        expires_at = CASE WHEN rsvp_rate_limits.expires_at <= ${now} THEN ${expires}
          ELSE rsvp_rate_limits.expires_at END
      RETURNING count, expires_at AS "expiresAt"
    `;
    return counter.count > LIMIT
      ? Math.max(
          1,
          Math.ceil((counter.expiresAt.getTime() - now.getTime()) / 1000),
        )
      : 0;
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

  private async cleanup(): Promise<void> {
    await this.database.getClient().$executeRaw`
      DELETE FROM rsvp_rate_limits WHERE (publication_id, client_key) IN (
        SELECT publication_id, client_key FROM rsvp_rate_limits
        WHERE expires_at <= now() ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED
      )
    `;
  }
}

function readRateSecret(): Buffer {
  const configured = process.env.RSVP_RATE_SECRET;
  if (configured && /^(?:[a-f0-9]{2}){32,}$/i.test(configured))
    return Buffer.from(configured, "hex");
  if (configured || process.env.NODE_ENV === "production")
    throw new Error(
      "RSVP_RATE_SECRET requires at least 32 random bytes in hex",
    );
  return randomBytes(32);
}
