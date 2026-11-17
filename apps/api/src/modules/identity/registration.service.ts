import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { Prisma } from "../../database/generated/client";
import { hashPassword } from "./password";
import { RegisterDto, RegisterResponseDto } from "./register.dto";
import { SessionService } from "./session.service";

@Injectable()
export class RegistrationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessions: SessionService,
  ) {}
  async register(
    input: RegisterDto,
    previousToken?: string,
  ): Promise<RegisterResponseDto & { token: string }> {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.database.getClient().$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, passwordHash },
          select: { id: true, email: true },
        });
        const token = await this.sessions.create(tx, user.id, previousToken);
        return { user, token };
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (await this.database.getClient().user.findUnique({
          where: { email: input.email },
          select: { id: true },
        }))
      ) {
        throw new ApiError(
          409,
          "EMAIL_UNAVAILABLE",
          "Этот email уже зарегистрирован",
        );
      }
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Не удалось создать аккаунт. Повторите позже",
      );
    }
  }
}
