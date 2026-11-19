import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import type { PendingRegistration, Prisma } from "../../database/generated/client";
import { hashPassword } from "./password";
import { RegisterDto } from "./register.dto";
import { SessionService } from "./session.service";
import { ResetMailService } from "./reset-mail.service";
import { ResetRateService } from "./reset-rate.service";
import { AuthClock } from "./auth-clock";
import { ConfirmRegistrationDto, RegistrationPendingDto } from "./registration-code.dto";

@Injectable()
export class RegistrationService implements OnModuleInit, OnModuleDestroy {
  private readonly secret: Buffer;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly database: DatabaseService,
    private readonly sessions: SessionService,
    private readonly mail: ResetMailService,
    private readonly limits: ResetRateService,
    private readonly clock: AuthClock,
  ) {
    const secret = process.env.REGISTRATION_CODE_SECRET;
    if (secret && !/^(?:[a-f0-9]{2}){32,}$/i.test(secret))
      throw new Error("REGISTRATION_CODE_SECRET requires at least 32 random bytes in hex");
    this.secret = secret ? Buffer.from(secret, "hex") : randomBytes(32);
  }
  onModuleInit(): void {
    // Small bounded retention sweep, not a delivery queue. No DB required for liveness.
    this.timer = setInterval(() => {
      if (process.env.DATABASE_URL) void this.cleanup().catch(() => undefined);
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
  async cleanup(): Promise<void> {
    await this.database.getClient().$executeRaw`
      DELETE FROM pending_registrations WHERE email IN (
        SELECT email FROM pending_registrations WHERE delete_at <= ${this.clock.now()}
        ORDER BY delete_at LIMIT 500 FOR UPDATE SKIP LOCKED
      )`;
  }
  private digest(email: string, nonce: string, code: string): string {
    return createHmac("sha256", this.secret)
      .update(JSON.stringify(["registration", email, nonce, code])).digest("hex");
  }
  private matches(row: PendingRegistration, code: string): boolean {
    return timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(this.digest(row.email, row.nonce, code), "hex"));
  }
  private invalid(): ApiError {
    return new ApiError(400, "REGISTRATION_CODE_INVALID", "Код недействителен или срок его действия истёк");
  }
  private async lock(tx: Prisma.TransactionClient, email: string, checkUser = true): Promise<void> {
    // Serializes absent-user creation and pending replacement for the same email.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`;
    if (checkUser && await tx.user.findUnique({ where: { email }, select: { id: true } }))
      throw new ApiError(409, "EMAIL_UNAVAILABLE", "Этот email уже зарегистрирован");
  }
  private async deliver(row: PendingRegistration, code: string): Promise<RegistrationPendingDto> {
    // SMTP/file IO outside transaction; an obsolete delivery cannot activate a new challenge.
    await this.mail.send({ purpose: "registration", id: row.nonce, to: row.email, code, expiresAt: row.expiresAt.toISOString() });
    await this.database.getClient().pendingRegistration.updateMany({
      where: { id: row.id, nonce: row.nonce }, data: { deliveredAt: this.clock.now() },
    });
    return { registrationId: row.id, expiresAt: row.expiresAt.toISOString() };
  }
  async register(input: RegisterDto, ip: string, response: Response): Promise<RegistrationPendingDto> {
    await this.mail.ready();
    await this.limits.reserve(input.email, ip, response, "registration-request");
    const passwordHash = await hashPassword(input.password);
    let code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const row = await this.database.getClient().$transaction(async tx => {
      await this.lock(tx, input.email);
      const previous = await tx.pendingRegistration.findUnique({ where: { email: input.email } });
      while (previous && this.matches(previous, code)) code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      const now = this.clock.now(), nonce = randomUUID();
      const data = { id: randomUUID(), nonce, userName: input.userName, passwordHash, codeHash: this.digest(input.email, nonce, code), attempts: 0,
        expiresAt: new Date(now.getTime() + 10 * 60_000), deleteAt: new Date(now.getTime() + 24 * 60 * 60_000), deliveredAt: null };
      return tx.pendingRegistration.upsert({ where: { email: input.email }, create: { email: input.email, ...data }, update: data });
    });
    return this.deliver(row, code);
  }
  async resend(id: string, ip: string, response: Response): Promise<RegistrationPendingDto> {
    await this.mail.ready();
    const db = this.database.getClient();
    const candidate = await db.pendingRegistration.findUnique({ where: { id } });
    if (!candidate || candidate.deleteAt <= this.clock.now()) throw this.invalid();
    await this.limits.reserve(candidate.email, ip, response, "registration-request");
    let code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const row = await db.$transaction(async tx => {
      await this.lock(tx, candidate.email);
      const current = await tx.pendingRegistration.findUnique({ where: { id } });
      if (!current || current.deleteAt <= this.clock.now()) throw this.invalid();
      while (this.matches(current, code)) code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      const nonce = randomUUID();
      return tx.pendingRegistration.update({ where: { id }, data: {
        nonce, codeHash: this.digest(current.email, nonce, code), attempts: 0, deliveredAt: null,
        expiresAt: new Date(Math.min(this.clock.now().getTime() + 10 * 60_000, current.deleteAt.getTime())),
      } });
    });
    return this.deliver(row, code);
  }
  async confirm(input: ConfirmRegistrationDto, previousToken?: string) {
    await this.mail.ready();
    const db = this.database.getClient();
    const candidate = await db.pendingRegistration.findUnique({ where: { id: input.registrationId } });
    if (!candidate) throw this.invalid();
    const result = await db.$transaction(async tx => {
      await this.lock(tx, candidate.email, false);
      const row = await tx.pendingRegistration.findUnique({ where: { id: input.registrationId } });
      const now = this.clock.now();
      if (!row || row.expiresAt <= now || row.deleteAt <= now || row.attempts >= 5) return null;
      if (!row.deliveredAt || !this.matches(row, input.code)) {
        await tx.pendingRegistration.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
        return null; // Commit attempt; throw after transaction.
      }
      const user = await tx.user.create({ data: { email: row.email, userName: row.userName, passwordHash: row.passwordHash, emailVerifiedAt: now }, select: { id: true, email: true, userName: true } });
      const token = await this.sessions.create(tx, user.id, previousToken);
      await tx.pendingRegistration.delete({ where: { id: row.id } });
      return { user, token };
    });
    if (!result) throw this.invalid();
    return result;
  }
}
