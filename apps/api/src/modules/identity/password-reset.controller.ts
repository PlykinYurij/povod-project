import { Body, Controller, Header, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiErrorDto } from "../../http/api-error";
import { CsrfGuard } from "./csrf.guard";
import { RegistrationOriginGuard } from "./registration-origin.guard";
import { ConfirmPasswordResetDto, PasswordResetAcceptedDto, RequestPasswordResetDto } from "./password-reset.dto";
import { PasswordResetService } from "./password-reset.service";

@ApiTags("auth")
@Controller("api/v1/auth/password-reset")
@UseGuards(RegistrationOriginGuard, CsrfGuard)
@ApiHeader({ name: "X-CSRF-Token", required: true })
@ApiResponse({ status: 400, type: ApiErrorDto, description: "MALFORMED_JSON or RESET_CODE_INVALID on confirm" })
@ApiResponse({ status: 403, type: ApiErrorDto, description: "CSRF_FAILED" })
@ApiResponse({ status: 413, type: ApiErrorDto, description: "BODY_TOO_LARGE" })
@ApiResponse({ status: 415, type: ApiErrorDto, description: "UNSUPPORTED_MEDIA_TYPE" })
@ApiResponse({ status: 422, type: ApiErrorDto, description: "VALIDATION_FAILED" })
@ApiResponse({ status: 503, type: ApiErrorDto, description: "SERVICE_UNAVAILABLE" })
export class PasswordResetController {
  constructor(private readonly reset: PasswordResetService) {}

  @Post("request")
  @HttpCode(202)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "requestPasswordReset", summary: "Request or resend a code; response does not disclose account existence" })
  @ApiResponse({ status: 202, type: PasswordResetAcceptedDto })
  @ApiResponse({ status: 429, type: ApiErrorDto, description: "RATE_LIMITED", headers: { "Retry-After": { schema: { type: "integer" } } } })
  request(@Body() input: RequestPasswordResetDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.reset.request(input.email, request.ip ?? request.socket.remoteAddress ?? "unknown", response);
  }

  @Post("confirm")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "confirmPasswordReset", summary: "Consume the code, change password and revoke all sessions; no automatic login" })
  @ApiResponse({ status: 204, description: "Password changed; all sessions revoked" })
  confirm(@Body() input: ConfirmPasswordResetDto): Promise<void> {
    return this.reset.confirm(input);
  }
}
