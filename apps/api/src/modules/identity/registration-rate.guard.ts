import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ApiError } from "../../http/api-error";

export function registrationLimit(): number {
  const value = process.env.REGISTER_RATE_LIMIT ?? "5"; // local trial, not an agreed production policy
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1000)
    throw new Error("Invalid REGISTER_RATE_LIMIT");
  return Number(value);
}
@Injectable()
export class RegistrationRateGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.REGISTER_RATE_LIMIT
    ) {
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Регистрация ещё не настроена",
      );
    }
    return super.canActivate(context);
  }
  protected override async throwThrottlingException(
    _context: ExecutionContext,
  ): Promise<void> {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Слишком много попыток. Повторите позже",
    );
  }
}
