import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import type { AuthenticatedRequest } from "../identity/session.guard";

/** Role is read for each request, never trusted from cookies or a cached actor. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) {
      throw new ApiError(401, "AUTH_REQUIRED", "Требуется вход");
    }
    const user = await this.database.getClient().user.findUnique({
      where: { id: request.actor.id },
      select: { role: true },
    });
    if (!user) {
      throw new ApiError(401, "AUTH_REQUIRED", "Требуется вход");
    }
    if (user.role !== "ADMIN") {
      throw new ApiError(
        403,
        "ADMIN_REQUIRED",
        "Требуются права администратора",
      );
    }
    return true;
  }
}
