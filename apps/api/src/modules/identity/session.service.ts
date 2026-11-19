import { Injectable, OnModuleInit } from "@nestjs/common";
import type { Request, Response } from "express";
import { DatabaseService } from "../../database/database.service";
import { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { hashAuthToken, randomAuthToken } from "./auth-crypto";
import { hashPassword, verifyPassword } from "./password";
import {
  readAuthCookie,
  SESSION_IDLE_MS,
  SESSION_MAX_SECONDS,
  writeAuthCookie,
} from "./auth-cookies";
import { LoginAttemptsService } from "./login-attempts.service";
import type { LoginDto } from "./session.dto";
import { AuthClock } from "./auth-clock";

@Injectable()
export class SessionService implements OnModuleInit {
  private dummyHash!: string;
  constructor(
    private readonly database: DatabaseService,
    private readonly attempts: LoginAttemptsService,
    private readonly clock: AuthClock,
  ) {}
  async onModuleInit(): Promise<void> {
    this.dummyHash = await hashPassword(`${randomAuthToken()}A1!`);
  }
  async create(
    tx: Prisma.TransactionClient,
    userId: string,
    previousToken?: string,
  ): Promise<string> {
    const now = this.clock.now();
    if (previousToken)
      await tx.session.updateMany({
        where: { tokenHash: hashAuthToken(previousToken), revokedAt: null },
        data: { revokedAt: now },
      });
    await tx.session.deleteMany({ where: { expiresAt: { lte: now } } });
    const token = randomAuthToken();
    await tx.session.create({
      data: {
        tokenHash: hashAuthToken(token),
        userId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + SESSION_MAX_SECONDS * 1000),
      },
    });
    return token;
  }
  attach(response: Response, token: string): void {
    writeAuthCookie(response, "session", token, SESSION_MAX_SECONDS);
  }
  async login(input: LoginDto, request: Request, response: Response) {
    const reservation = await this.attempts.reserve(
      input.email,
      request.ip ?? request.socket.remoteAddress ?? "unknown",
      response,
    );
    try {
      const db = this.database.getClient();
      const user = await db.user.findUnique({ where: { email: input.email } });
      const valid = await verifyPassword(
        user?.passwordHash ?? this.dummyHash,
        input.password,
      );
      if (!user || !valid)
        throw new ApiError(
          401,
          "INVALID_CREDENTIALS",
          "Неверный email или пароль",
        );
      const token = await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          { passwordHash: string }[]
        >`SELECT password_hash AS "passwordHash" FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
        if (locked[0]?.passwordHash !== user.passwordHash)
          throw new ApiError(
            401,
            "INVALID_CREDENTIALS",
            "Неверный email или пароль",
          );
        const created = await this.create(
          tx,
          user.id,
          readAuthCookie(request, "session"),
        );
        await tx.loginAttempt.deleteMany({
          where: { key: reservation.key, expiresAt: reservation.expiresAt },
        });
        return created;
      });
      this.attach(response, token);
      return { user: { id: user.id, email: user.email, userName: user.userName } };
    } catch (error) {
      if (!(error instanceof ApiError && error.getStatus() === 401))
        await this.attempts
          .release(reservation.key, reservation.expiresAt)
          .catch(() => undefined);
      throw error;
    }
  }
  async current(request: Request) {
    const token = readAuthCookie(request, "session");
    if (!token) throw new ApiError(401, "AUTH_REQUIRED", "Требуется вход");
    const now = this.clock.now();
    const digest = hashAuthToken(token);
    const updated = await this.database.getClient().$queryRaw<
      { userId: string }[]
    >`
      UPDATE sessions SET last_seen_at = GREATEST(last_seen_at, ${now})
      WHERE token_hash = ${digest} AND revoked_at IS NULL AND expires_at > ${now}
      AND last_seen_at > ${new Date(now.getTime() - SESSION_IDLE_MS)} RETURNING user_id AS "userId"`;
    if (!updated[0]) throw new ApiError(401, "AUTH_REQUIRED", "Требуется вход");
    const session = await this.database.getClient().session.findFirst({
      where: { tokenHash: digest, revokedAt: null, expiresAt: { gt: now } },
      select: { user: { select: { id: true, email: true, userName: true } } },
    });
    if (!session) throw new ApiError(401, "AUTH_REQUIRED", "Требуется вход");
    return { user: session.user };
  }
  async logout(request: Request, response: Response): Promise<void> {
    const token = readAuthCookie(request, "session");
    if (token)
      await this.database.getClient().session.updateMany({
        where: { tokenHash: hashAuthToken(token), revokedAt: null },
        data: { revokedAt: this.clock.now() },
      });
    writeAuthCookie(response, "session", "", 0);
  }
}
