import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ApiErrorDto } from "../../http/api-error";
import { AdminGuard } from "../administration/admin.guard";
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import { ProjectIdDto } from "../projects/project.dto";
import { RsvpDashboardDto, RsvpDashboardQueryDto } from "./rsvp-dashboard.dto";
import { RsvpDashboardService } from "./rsvp-dashboard.service";

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
  constructor(private readonly dashboard: RsvpDashboardService) {}

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
}
