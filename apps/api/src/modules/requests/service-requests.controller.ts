import {
  Body,
  Controller,
  Header,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiError, ApiErrorDto } from "../../http/api-error";
import { JsonOriginGuard } from "../../http/json-origin.guard";
import {
  readIdempotencyKey,
  rejectUnknownQuery,
} from "../../http/request-contract";
import {
  CreateServiceRequestDto,
  ServiceRequestReceiptDto,
} from "./service-request.dto";
import { ServiceRequestsService } from "./service-requests.service";

@ApiTags("requests")
@Controller("api/v1/service-requests")
export class ServiceRequestsController {
  constructor(private readonly requests: ServiceRequestsService) {}

  @Post()
  @UseGuards(JsonOriginGuard)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    operationId: "createServiceRequest",
    summary:
      "Public assistance request; no session, no project, no publication",
  })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiResponse({
    status: 201,
    type: ServiceRequestReceiptDto,
    description: "New request received",
  })
  @ApiResponse({
    status: 200,
    type: ServiceRequestReceiptDto,
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
    description: "CSRF_FAILED: origin rejected",
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "IDEMPOTENCY_KEY_REUSED",
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
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: "SERVICE_UNAVAILABLE",
  })
  async create(
    @Body() input: CreateServiceRequestDto,
    @Headers("idempotency-key") key: unknown,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceRequestReceiptDto> {
    rejectUnknownQuery(query);
    const result = await this.requests.create(
      input,
      readIdempotencyKey(key),
      request.ip ?? request.socket.remoteAddress ?? "unknown",
    );
    if (result.kind === "rate-limited") {
      response.setHeader("Retry-After", result.retryAfterSeconds);
      throw new ApiError(429, "RATE_LIMITED", "Повторите запрос позже");
    }
    response.status(result.replay ? 200 : 201);
    return result.receipt;
  }
}
