import {
  Body,
  Controller,
  Header,
  Post,
  UseGuards,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RegisterDto, RegisterResponseDto } from "./register.dto";
import { RegistrationService } from "./registration.service";
import { RegistrationOriginGuard } from "./registration-origin.guard";
import { ApiErrorDto } from "../../http/api-error";
import { RegistrationRateGuard } from "./registration-rate.guard";
import { SessionService } from "./session.service";
import { CsrfGuard } from "./csrf.guard";
import { readAuthCookie } from "./auth-cookies";
import type { Request, Response } from "express";
import { ApiHeader } from "@nestjs/swagger";

@ApiTags("auth")
@Controller("api/v1/auth")
export class RegistrationController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly sessions: SessionService,
  ) {}
  @Post("register")
  @Header("Cache-Control", "no-store")
  @UseGuards(RegistrationOriginGuard, CsrfGuard, RegistrationRateGuard)
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOperation({
    operationId: "register",
    summary: "Create an owner account and authenticated session atomically",
  })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "MALFORMED_JSON",
  })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: "CSRF_FAILED" })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "EMAIL_UNAVAILABLE",
  })
  @ApiResponse({
    status: 413,
    type: ApiErrorDto,
    description: "BODY_TOO_LARGE",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    description: "RATE_LIMITED; Retry-After in seconds",
    headers: {
      "Retry-After": {
        schema: { type: "integer", minimum: 1 },
        description: "Seconds before retry",
      },
    },
  })
  @ApiResponse({
    status: 415,
    type: ApiErrorDto,
    description: "UNSUPPORTED_MEDIA_TYPE",
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description: "VALIDATION_FAILED",
  })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: "SERVICE_UNAVAILABLE",
  })
  async register(
    @Body() input: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegisterResponseDto> {
    const { user, token } = await this.registration.register(
      input,
      readAuthCookie(request, "session"),
    );
    this.sessions.attach(response, token);
    return { user };
  }
}
