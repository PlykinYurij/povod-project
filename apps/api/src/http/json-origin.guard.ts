import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ApiError } from "./api-error";
import { webOrigin } from "./web-origin";

/** Origin and JSON check, independent of identity/cookie authentication. */
@Injectable()
export class JsonOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const allowed = webOrigin();
    if (!allowed || request.get("origin") !== allowed) {
      throw new ApiError(403, "CSRF_FAILED", "Недопустимый источник запроса");
    }
    if (!request.is("application/json")) {
      throw new ApiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Ожидается application/json",
      );
    }
    return true;
  }
}
