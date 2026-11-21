import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  Patch,
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
import { rejectUnknownQuery } from "../../http/request-contract";
import { CsrfGuard } from "../identity/csrf.guard";
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import {
  ProjectDto,
  ProjectIdDto,
  SaveProjectDraftDto,
} from "../projects/project.dto";
import { AdminGuard } from "./admin.guard";
import { CreateAssistedProjectDto } from "./assisted-project.dto";
import { AssistedProjectsService } from "./assisted-projects.service";

@ApiTags("administration")
@ApiCookieAuth("session")
@ApiHeader({ name: "X-CSRF-Token", required: true })
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@ApiResponse({ status: 404, type: ApiErrorDto })
@ApiResponse({ status: 409, type: ApiErrorDto })
@ApiResponse({ status: 422, type: ApiErrorDto })
@UseGuards(SessionGuard, AdminGuard, JsonOriginGuard, CsrfGuard)
@Controller("api/v1/admin/requests/:id/project")
export class AssistedProjectsController {
  constructor(private readonly projects: AssistedProjectsService) {}

  @Post()
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "createAssistedProject" })
  @ApiResponse({ status: 200, type: ProjectDto })
  create(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Body() input: CreateAssistedProjectDto,
    @Query() query: Record<string, unknown>,
  ): Promise<ProjectDto> {
    rejectUnknownQuery(query);
    return this.projects.create(requireActor(request).id, params.id, input);
  }

  @Patch("draft")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "saveAssistedDraft" })
  @ApiResponse({ status: 200, type: ProjectDto })
  save(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Body() input: SaveProjectDraftDto,
    @Query() query: Record<string, unknown>,
  ): Promise<ProjectDto> {
    rejectUnknownQuery(query);
    return this.projects.save(requireActor(request).id, params.id, input);
  }
}
