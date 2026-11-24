import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { ApiError, ApiErrorDto } from "../../http/api-error";
import { JsonOriginGuard } from "../../http/json-origin.guard";
import { rejectUnknownQuery } from "../../http/request-contract";
import { AdminGuard } from "../administration/admin.guard";
import { CsrfGuard } from "../identity/csrf.guard";
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import { ProjectIdDto } from "../projects/project.dto";
import { RsvpDashboardDto, RsvpDashboardQueryDto } from "./rsvp-dashboard.dto";
import { RsvpDashboardService, type RsvpScope } from "./rsvp-dashboard.service";
import { RsvpDeletionService } from "./rsvp-deletion.service";
import { RSVP_XLSX_MIME, rsvpWorkbook } from "./rsvp-workbook";

class DeleteRsvpParamsDto extends ProjectIdDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  responseId!: string;
}

const xlsxResponse = {
  status: 200,
  content: {
    [RSVP_XLSX_MIME]: { schema: { type: "string", format: "binary" } },
  },
};

@ApiTags("rsvp")
@ApiCookieAuth("session")
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({
  status: 404,
  type: ApiErrorDto,
  description: "RSVP_DASHBOARD_UNAVAILABLE",
})
@ApiResponse({ status: 422, type: ApiErrorDto })
@ApiResponse({ status: 503, type: ApiErrorDto })
@UseGuards(SessionGuard)
@Controller("api/v1")
export class RsvpDashboardController {
  constructor(
    private readonly dashboard: RsvpDashboardService,
    private readonly deletion: RsvpDeletionService,
  ) {}

  @Get("projects/:id/responses")
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ operationId: "listProjectResponses" })
  @ApiResponse({ status: 200, type: RsvpDashboardDto })
  owner(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Query() query: RsvpDashboardQueryDto,
  ): Promise<RsvpDashboardDto> {
    return this.dashboard.list(
      {
        kind: "owner",
        projectId: params.id,
        ownerId: requireActor(request).id,
      },
      query.attendance,
    );
  }

  @Get("admin/requests/:id/responses")
  @UseGuards(AdminGuard)
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ operationId: "listAssistedResponses" })
  @ApiResponse({ status: 200, type: RsvpDashboardDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  assisted(
    @Param() params: ProjectIdDto,
    @Query() query: RsvpDashboardQueryDto,
  ): Promise<RsvpDashboardDto> {
    return this.dashboard.list(
      { kind: "assisted", requestId: params.id },
      query.attendance,
    );
  }

  @Get("projects/:id/responses/export")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ operationId: "exportProjectResponses" })
  @ApiResponse(xlsxResponse)
  exportOwner(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Query() query: Record<string, unknown>,
  ) {
    const actor = requireActor(request);
    return this.export(
      { kind: "owner", projectId: params.id, ownerId: actor.id },
      query,
    );
  }

  @Get("admin/requests/:id/responses/export")
  @UseGuards(AdminGuard)
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ operationId: "exportAssistedResponses" })
  @ApiResponse(xlsxResponse)
  @ApiResponse({ status: 403, type: ApiErrorDto })
  exportAssisted(
    @Param() params: ProjectIdDto,
    @Query() query: Record<string, unknown>,
  ) {
    return this.export({ kind: "assisted", requestId: params.id }, query);
  }

  @Delete("projects/:id/responses/:responseId")
  @UseGuards(JsonOriginGuard, CsrfGuard)
  @HttpCode(204)
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ operationId: "deleteProjectResponse" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  removeOwner(
    @Req() request: AuthenticatedRequest,
    @Param() params: DeleteRsvpParamsDto,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ): Promise<void> {
    assertEmptyDeletion(body, query);
    const actor = requireActor(request);
    return this.deletion.remove(
      { kind: "owner", projectId: params.id, ownerId: actor.id },
      actor.id,
      params.responseId,
    );
  }

  @Delete("admin/requests/:id/responses/:responseId")
  @UseGuards(AdminGuard, JsonOriginGuard, CsrfGuard)
  @HttpCode(204)
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ operationId: "deleteAssistedResponse" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  removeAssisted(
    @Req() request: AuthenticatedRequest,
    @Param() params: DeleteRsvpParamsDto,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ): Promise<void> {
    assertEmptyDeletion(body, query);
    return this.deletion.remove(
      { kind: "assisted", requestId: params.id },
      requireActor(request).id,
      params.responseId,
    );
  }

  private async export(scope: RsvpScope, query: Record<string, unknown>) {
    rejectUnknownQuery(query);
    const { items } = await this.dashboard.list(scope);
    const workbook = rsvpWorkbook(items);
    return new StreamableFile(workbook, {
      type: RSVP_XLSX_MIME,
      disposition: 'attachment; filename="rsvp-responses.xlsx"',
      length: workbook.length,
    });
  }
}

function assertEmptyDeletion(
  body: unknown,
  query: Record<string, unknown>,
): void {
  rejectUnknownQuery(query);
  if (body === undefined) return;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length
  )
    throw new ApiError(
      422,
      "VALIDATION_FAILED",
      "Тело запроса должно быть пустым",
    );
}
