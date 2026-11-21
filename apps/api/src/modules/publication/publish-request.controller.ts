import {
  Body,
  Controller,
  Header,
  Headers,
  Param,
  Post,
  Query,
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
import type { Response } from "express";
import { ApiErrorDto } from "../../http/api-error";
import { JsonOriginGuard } from "../../http/json-origin.guard";
import {
  readIdempotencyKey,
  rejectUnknownQuery,
} from "../../http/request-contract";
import { AdminGuard } from "../administration/admin.guard";
import { CsrfGuard } from "../identity/csrf.guard";
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import { ProjectIdDto } from "../projects/project.dto";
import {
  PublicationReceiptDto,
  PublishRequestDto,
} from "./publish-request.dto";
import { PublishRequestService } from "./publish-request.service";

@ApiTags("administration")
@ApiCookieAuth("session")
@UseGuards(SessionGuard, AdminGuard, JsonOriginGuard, CsrfGuard)
@Controller("api/v1/admin/requests/:id/publish")
export class PublishRequestController {
  constructor(private readonly publisher: PublishRequestService) {}

  @Post()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "publishAdminRequest" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiResponse({
    status: 201,
    type: PublicationReceiptDto,
    description: "Publication committed",
  })
  @ApiResponse({
    status: 200,
    type: PublicationReceiptDto,
    description: "Original receipt replayed",
  })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      "REQUEST_PROJECT_REQUIRED, REQUEST_STATE_CONFLICT, REVISION_CONFLICT, PRICE_NOT_CONFIGURED, PRICE_CHANGED, ALREADY_PUBLISHED, IDEMPOTENCY_KEY_REUSED, PUBLICATION_LIMIT_REACHED or SLUG_TAKEN",
  })
  @ApiResponse({ status: 413, type: ApiErrorDto })
  @ApiResponse({ status: 415, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  @ApiResponse({ status: 503, type: ApiErrorDto })
  async publish(
    @Req() request: AuthenticatedRequest,
    @Param() { id }: ProjectIdDto,
    @Body() input: PublishRequestDto,
    @Headers("idempotency-key") key: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicationReceiptDto> {
    rejectUnknownQuery(query);
    const result = await this.publisher.publish(
      requireActor(request).id,
      id,
      input,
      readIdempotencyKey(key),
    );
    response.status(result.replay ? 200 : 201);
    return result.receipt;
  }
}
