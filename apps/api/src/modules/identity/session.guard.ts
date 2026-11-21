import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { RegisteredUserDto } from "./register.dto";
import { SessionService } from "./session.service";
import { ApiError } from "../../http/api-error";

export interface AuthenticatedRequest extends Request {
  actor?: RegisteredUserDto;
}

export function requireActor(request: AuthenticatedRequest): RegisteredUserDto {
  if (!request.actor)
    throw new ApiError(401, "AUTH_REQUIRED", "Требуется вход");
  return request.actor;
}
/** Authenticates the actor; each resource use-case must also check ownership. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.actor = (await this.sessions.current(request)).user;
    return true;
  }
}
