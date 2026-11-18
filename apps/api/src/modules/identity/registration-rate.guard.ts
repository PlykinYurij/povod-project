import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ApiError } from "../../http/api-error";

export function registrationLimit(): number {
  const value =
    process.env.NODE_ENV === "production"
      ? "5"
      : (process.env.REGISTER_RATE_LIMIT ?? "5");
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1000)
    throw new Error("Invalid REGISTER_RATE_LIMIT");
  return Number(value);
}
@Injectable()
export class RegistrationRateGuard extends ThrottlerGuard {
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
