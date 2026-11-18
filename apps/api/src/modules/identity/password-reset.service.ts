import { Injectable } from "@nestjs/common";
import {
  createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual,
} from "node:crypto";
import type { Response } from "express";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { hashAuthToken } from "./auth-crypto";
import { AuthClock } from "./auth-clock";
import { hashPassword } from "./password";
import { ResetMailService } from "./reset-mail.service";
import { ResetRateService } from "./reset-rate.service";
import { ConfirmPasswordResetDto } from "./password-reset.dto";

@Injectable()
export class PasswordResetService {
  private readonly secret: Buffer;
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: AuthClock,
    private readonly mail: ResetMailService,
    private readonly limits: ResetRateService,
  ) {
    const configured = process.env.RESET_CODE_SECRET;
    if (configured && !/^(?:[a-f0-9]{2}){32,}$/i.test(configured))
      throw new Error("RESET_CODE_SECRET must contain at least 32 random bytes in hex");
    this.secret = configured ? Buffer.from(configured, "hex") : randomBytes(32);
  }
  private digest(id: string, emailKey: string, code: string): string {
    return createHmac("sha256", this.secret)
      .update(JSON.stringify(["password-reset", id, emailKey, code]))
      .digest("hex");
  }
  private matches(stored: string, id: string, emailKey: string, code: string): boolean {
    return timingSafeEqual(
      Buffer.from(stored, "hex"),
      Buffer.from(this.digest(id, emailKey, code), "hex"),
    );
  }
  async request(email: string, ip: string, response: Response): Promise<{ message: string }> {
    await this.mail.ready(); // Unavailable transport fails equally, before looking up email.
    await this.limits.reserve(email, ip, response);
    const emailKey = hashAuthToken(email);
    const id = randomUUID();
    let code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + 10 * 60_000);
    const user = await this.database.getClient().$transaction(async tx => {
      const users = await tx.$queryRaw<{ id: string; email: string }[]>`SELECT id, email FROM users WHERE email = ${email} FOR UPDATE`;
      const previous = await tx.passwordReset.findUnique({ where: { emailKey } });
      // Even an accidental repeated six-digit value must not revive the old code.
      while (previous && this.matches(previous.codeHash, previous.id, emailKey, code))
        code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      const data = {
        id, userId: users[0]?.id ?? null,
        codeHash: this.digest(id, emailKey, code), attempts: 0,
        expiresAt, deliveredAt: null, usedAt: null,
      };
      await tx.passwordReset.upsert({
        where: { emailKey }, create: { emailKey, ...data }, update: data,
      });
      return users[0];
    });
    if (user) {
      try {
        await this.mail.send({
          id, to: user.email, code, expiresAt: expiresAt.toISOString(),
        });
        await this.database.getClient().passwordReset.updateMany({
          where: { emailKey, id }, data: { deliveredAt: this.clock.now() },
        });
      } catch {
        // Neutral response avoids revealing whether an account/delivery exists.
        // Undelivered code remains unusable; the owner can request another.
      }
    }
    return { message: "Если аккаунт существует, письмо с кодом будет доступно в почте" };
  }
  async confirm(input: ConfirmPasswordResetDto): Promise<void> {
    await this.mail.ready();
    const db = this.database.getClient();
    const emailKey = hashAuthToken(input.email);
    const candidate = await db.passwordReset.findUnique({ where: { emailKey } });
    // Expensive hashing outside the User lock and only for a plausible valid code.
    const plausible = candidate && !candidate.usedAt && candidate.deliveredAt &&
      candidate.attempts < 5 && candidate.expiresAt > this.clock.now() &&
      this.matches(candidate.codeHash, candidate.id, emailKey, input.code);
    const passwordHash = plausible
      ? await hashPassword(input.newPassword) : undefined;
    const accepted = await db.$transaction(async tx => {
      const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE email = ${input.email} FOR UPDATE`;
      const resets = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM password_resets WHERE email_key = ${emailKey} FOR UPDATE`;
      if (!resets[0]) return false;
      const reset = await tx.passwordReset.findUniqueOrThrow({ where: { emailKey } });
      const now = this.clock.now();
      if (reset.usedAt || reset.expiresAt <= now || reset.attempts >= 5)
        return false;
      const valid = !!passwordHash && reset.id === candidate?.id &&
        reset.userId === users[0]?.id && !!users[0] && !!reset.deliveredAt &&
        this.matches(reset.codeHash, reset.id, emailKey, input.code);
      if (!valid) {
        await tx.passwordReset.update({
          where: { emailKey }, data: { attempts: { increment: 1 } },
        });
        return false; // Commit failed-attempt count, then throw outside transaction.
      }
      await tx.user.update({
        where: { id: users[0].id }, data: { passwordHash },
      });
      await tx.session.updateMany({
        where: { userId: users[0].id, revokedAt: null }, data: { revokedAt: now },
      });
      await tx.passwordReset.update({
        where: { emailKey }, data: { usedAt: now },
      });
      return true;
    });
    if (!accepted)
      throw new ApiError(
        400, "RESET_CODE_INVALID", "Код недействителен или срок его действия истёк",
      );
  }
}
