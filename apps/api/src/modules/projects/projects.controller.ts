import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Patch,
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
import {
  readIdempotencyKey,
  rejectUnknownQuery as rejectQuery,
} from "../../http/request-contract";
import { CsrfGuard } from "../identity/csrf.guard";
import { RegistrationOriginGuard } from "../identity/registration-origin.guard";
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import {
  CreateProjectDto,
  ProjectDto,
  ProjectIdDto,
  ProjectListDto,
  SaveProjectDraftDto,
} from "./project.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@ApiCookieAuth("session")
@ApiResponse({ status: 401, type: ApiErrorDto, description: "AUTH_REQUIRED" })
@ApiResponse({
  status: 422,
  type: ApiErrorDto,
  description: "VALIDATION_FAILED; nested field paths",
})
@ApiResponse({
  status: 503,
  type: ApiErrorDto,
  description: "SERVICE_UNAVAILABLE",
})
@UseGuards(SessionGuard)
@Controller("api/v1/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    operationId: "getProjects",
    summary: "Current owner's non-deleted projects; no content in list",
  })
  @ApiResponse({ status: 200, type: ProjectListDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<ProjectListDto> {
    rejectQuery(query);
    return this.projects.list(ownerId(request));
  }

  @Post()
  @Header("Cache-Control", "no-store")
  @UseGuards(RegistrationOriginGuard, CsrfGuard)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOperation({
    operationId: "createProject",
    summary:
      "Create a private draft; replay returns current project without resetting edits",
  })
  @ApiResponse({ status: 201, type: ProjectDto })
  @ApiResponse({
    status: 200,
    type: ProjectDto,
    description: "Same key and original body replay",
  })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: "CSRF_FAILED" })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: "TEMPLATE_NOT_FOUND or deleted replay PROJECT_NOT_FOUND",
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "DRAFT_LIMIT_REACHED or IDEMPOTENCY_KEY_REUSED",
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
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateProjectDto,
    @Query() query: Record<string, unknown>,
    @Headers("idempotency-key") key: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProjectDto> {
    rejectQuery(query);
    const result = await this.projects.create(
      ownerId(request),
      input,
      readIdempotencyKey(key),
    );
    response.status(result.replay ? 200 : 201);
    return result.project;
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getProject" })
  @ApiResponse({ status: 200, type: ProjectDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: "PROJECT_NOT_FOUND; neutral for unknown, foreign or deleted",
  })
  get(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Query() query: Record<string, unknown>,
  ): Promise<ProjectDto> {
    rejectQuery(query);
    return this.projects.get(ownerId(request), params.id);
  }

  @Patch(":id/draft")
  @Header("Cache-Control", "no-store")
  @UseGuards(RegistrationOriginGuard, CsrfGuard)
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOperation({
    operationId: "saveProjectDraft",
    summary:
      "Replace the whole draft payload at expectedRevision; no blind retry",
  })
  @ApiResponse({ status: 200, type: ProjectDto })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: "CSRF_FAILED" })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: "PROJECT_NOT_FOUND",
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "REVISION_CONFLICT or CONTENT_LOCKED",
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
  save(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Body() input: SaveProjectDraftDto,
    @Query() query: Record<string, unknown>,
  ): Promise<ProjectDto> {
    rejectQuery(query);
    return this.projects.save(ownerId(request), params.id, input);
  }
}

function ownerId(request: AuthenticatedRequest): string {
  return requireActor(request).id;
}
