import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiErrorDto } from "../../http/api-error";
import { SessionService } from "./session.service";
import { CsrfService } from "./csrf.service";
import { CsrfGuard } from "./csrf.guard";
import { RegistrationOriginGuard } from "./registration-origin.guard";
import { CsrfResponseDto, LoginDto } from "./session.dto";
import { RegisterResponseDto } from "./register.dto";
import { SessionGuard, AuthenticatedRequest } from "./session.guard";

@ApiTags("auth")
@Controller("api/v1/auth")
@ApiResponse({
  status: 503,
  type: ApiErrorDto,
  description: "SERVICE_UNAVAILABLE",
})
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly csrf: CsrfService,
  ) {}
  @Get("csrf")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getCsrfToken" })
  @ApiResponse({ status: 200, type: CsrfResponseDto })
  csrfToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.csrf.issue(request, response);
  }
  @Post("login")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(RegistrationOriginGuard, CsrfGuard)
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOperation({ operationId: "login" })
  @ApiResponse({ status: 200, type: RegisterResponseDto })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: "INVALID_CREDENTIALS",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "MALFORMED_JSON",
  })
  @ApiResponse({
    status: 413,
    type: ApiErrorDto,
    description: "BODY_TOO_LARGE",
  })
  @ApiResponse({
    status: 415,
    type: ApiErrorDto,
    description: "UNSUPPORTED_MEDIA_TYPE",
  })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: "CSRF_FAILED" })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description: "VALIDATION_FAILED",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    description: "RATE_LIMITED",
    headers: { "Retry-After": { schema: { type: "integer" } } },
  })
  login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.sessions.login(input, request, response);
  }
  @Get("session")
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store")
  @ApiCookieAuth("session")
  @ApiOperation({ operationId: "getSession" })
  @ApiResponse({ status: 200, type: RegisterResponseDto })
  @ApiResponse({ status: 401, type: ApiErrorDto, description: "AUTH_REQUIRED" })
  current(@Req() request: AuthenticatedRequest) {
    return { user: request.actor! };
  }
  @Post("logout")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @UseGuards(RegistrationOriginGuard, CsrfGuard)
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOperation({ operationId: "logout" })
  @ApiResponse({
    status: 204,
    description: "Current session revoked; repeated or expired also succeeds",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "MALFORMED_JSON",
  })
  @ApiResponse({
    status: 413,
    type: ApiErrorDto,
    description: "BODY_TOO_LARGE",
  })
  @ApiResponse({
    status: 415,
    type: ApiErrorDto,
    description: "UNSUPPORTED_MEDIA_TYPE",
  })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: "CSRF_FAILED" })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.logout(request, response);
  }
}
