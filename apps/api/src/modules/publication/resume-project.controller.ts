import {
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
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
  ResumeProjectDto,
  ResumeReceiptDto,
} from "./resume-project.dto";
import { ResumeProjectService } from "./resume-project.service";

@ApiTags("administration")
@ApiCookieAuth("session")
@UseGuards(SessionGuard, AdminGuard, JsonOriginGuard, CsrfGuard)
@Controller("api/v1/admin/projects/:id/resume")
export class ResumeProjectController {
  constructor(private readonly service: ResumeProjectService) {}

  @Post()
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "resumeAdminProject" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiResponse({ status: 200, type: ResumeReceiptDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      "PUBLICATION_STATE_CONFLICT, REVISION_CONFLICT or IDEMPOTENCY_KEY_REUSED",
  })
  @ApiResponse({ status: 413, type: ApiErrorDto })
  @ApiResponse({ status: 415, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  @ApiResponse({ status: 503, type: ApiErrorDto })
  resume(
    @Req() request: AuthenticatedRequest,
    @Param() { id }: ProjectIdDto,
    @Body() input: ResumeProjectDto,
    @Headers("idempotency-key") key: unknown,
    @Query() query: Record<string, unknown>,
  ) {
    rejectUnknownQuery(query);
    return this.service.resume(
      requireActor(request).id,
      id,
      input,
      readIdempotencyKey(key),
    );
  }
}
