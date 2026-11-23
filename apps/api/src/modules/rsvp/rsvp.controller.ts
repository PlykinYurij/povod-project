import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiError, ApiErrorDto } from "../../http/api-error";
import {
  readIdempotencyKey,
  rejectUnknownQuery,
} from "../../http/request-contract";
import { PublicRsvpFormDto, RsvpReceiptDto, SubmitRsvpDto } from "./rsvp.dto";
import { PUBLICATION_SLUG } from "../publication/publication-address";
import { invitationUnavailable } from "../publication/active-publication";
import { RsvpService } from "./rsvp.service";
import { rsvpClientIp } from "./rsvp-relay";

@Injectable()
class RsvpJsonGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
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

@ApiTags("rsvp")
@ApiParam({
  name: "slug",
  schema: { type: "string", pattern: PUBLICATION_SLUG.source },
})
@ApiResponse({
  status: 404,
  type: ApiErrorDto,
  description: "INVITATION_UNAVAILABLE",
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
@Controller("api/v1/public/invitations/by-address/:slug/rsvp")
export class RsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getPublicRsvpForm" })
  @ApiResponse({ status: 200, type: PublicRsvpFormDto })
  getForm(
    @Param("slug") slug: string,
    @Query() query: Record<string, unknown>,
  ): Promise<PublicRsvpFormDto> {
    rejectUnknownQuery(query);
    if (!PUBLICATION_SLUG.test(slug)) throw invitationUnavailable();
    return this.rsvp.getForm(slug);
  }

  @Post()
  @UseGuards(RsvpJsonGuard)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "submitPublicRsvp" })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiResponse({
    status: 201,
    type: RsvpReceiptDto,
    description: "Response stored",
  })
  @ApiResponse({
    status: 200,
    type: RsvpReceiptDto,
    description: "Original receipt replayed",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "MALFORMED_JSON",
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: "RSVP_RELAY_REQUIRED",
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      "IDEMPOTENCY_KEY_REUSED, RSVP_FORM_CHANGED, RSVP_LIMIT_REACHED or RSVP_RESPONSE_DELETED",
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
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    description: "RATE_LIMITED",
    headers: { "Retry-After": { schema: { type: "integer" } } },
  })
  async submit(
    @Param("slug") slug: string,
    @Body() input: SubmitRsvpDto,
    @Headers("idempotency-key") key: unknown,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RsvpReceiptDto> {
    rejectUnknownQuery(query);
    if (!PUBLICATION_SLUG.test(slug)) throw invitationUnavailable();
    const result = await this.rsvp.submit(
      slug,
      input,
      readIdempotencyKey(key),
      rsvpClientIp(request),
    );
    if ("retryAfter" in result) {
      response.setHeader("Retry-After", result.retryAfter);
      throw new ApiError(429, "RATE_LIMITED", "Повторите позже");
    }
    response.status(result.replay ? 200 : 201);
    return result.receipt;
  }
}
