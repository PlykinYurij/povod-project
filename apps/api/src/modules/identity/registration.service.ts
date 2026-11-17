import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { Prisma } from "../../database/generated/client";
import { hashPassword } from "./password";
import { RegisterDto, RegisterResponseDto } from "./register.dto";

@Injectable()
export class RegistrationService {
  constructor(private readonly database: DatabaseService) {}
  async register(input: RegisterDto): Promise<RegisterResponseDto> {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.database.getClient().user.create({
        data: { email: input.email, passwordHash },
        select: { id: true, email: true },
      });
      return { user };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (await this.database
          .getClient()
          .user.findUnique({
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
