import {
  Body,
  Controller,
  Get,
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
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import { CsrfGuard } from "../identity/csrf.guard";
import { ProjectIdDto } from "../projects/project.dto";
import {
  CreatePublicationRequestDto,
  ProjectPublicationRequestDto,
} from "./publication-request.dto";
import { ServiceRequestReceiptDto } from "./service-request.dto";
import { PublicationRequestsService } from "./publication-requests.service";
import { submissionResponse } from "./request-submission";

@ApiTags("requests")
@ApiCookieAuth("session")
@UseGuards(SessionGuard)
@ApiResponse({ status: 401, type: ApiErrorDto, description: "AUTH_REQUIRED" })
@ApiResponse({
  status: 404,
  type: ApiErrorDto,
  description: "PROJECT_NOT_FOUND",
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
@Controller("api/v1")
export class PublicationRequestsController {
  constructor(private readonly requests: PublicationRequestsService) {}

  @Post("publication-requests")
  @UseGuards(JsonOriginGuard, CsrfGuard)
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({
    operationId: "createPublicationRequest",
    summary:
      "Owner submits project to operator review without locking the draft",
  })
  @ApiResponse({ status: 201, type: ServiceRequestReceiptDto })
  @ApiResponse({
    status: 200,
    type: ServiceRequestReceiptDto,
    description: "Original receipt replay",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "MALFORMED_JSON",
  })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: "CSRF_FAILED" })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      "IDEMPOTENCY_KEY_REUSED / REQUEST_ALREADY_OPEN / REVISION_CONFLICT / PRICE_CHANGED / CONTENT_LOCKED",
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
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreatePublicationRequestDto,
    @Headers("idempotency-key") key: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceRequestReceiptDto> {
    rejectUnknownQuery(query);
    const result = await this.requests.create(
      requireActor(request).id,
      input,
      readIdempotencyKey(key),
      request.ip ?? request.socket.remoteAddress ?? "unknown",
    );
    return submissionResponse(result, response);
  }

  @Get("projects/:id/publication-request")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    operationId: "getProjectPublicationRequest",
    summary: "Owner's current open request metadata; no contact details",
  })
  @ApiResponse({ status: 200, type: ProjectPublicationRequestDto })
  current(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Query() query: Record<string, unknown>,
  ): Promise<ProjectPublicationRequestDto> {
    rejectUnknownQuery(query);
    return this.requests.current(requireActor(request).id, params.id);
  }
}
