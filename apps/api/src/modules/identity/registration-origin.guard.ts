import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ApiError } from "../../http/api-error";
import { webOrigin } from "../../http/web-origin";

@Injectable()
export class RegistrationOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const allowed = webOrigin();
    if (!allowed || request.get("origin") !== allowed)
      throw new ApiError(403, "CSRF_FAILED", "Недопустимый источник запроса");
    if (!request.is("application/json"))
      throw new ApiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Ожидается application/json",
      );
    return true;
  }
}
