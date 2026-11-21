import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
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
import { rejectUnknownQuery } from "../../http/request-contract";
import { JsonOriginGuard } from "../../http/json-origin.guard";
import { CsrfGuard } from "../identity/csrf.guard";
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import { ProjectIdDto } from "../projects/project.dto";
import { AdminGuard } from "./admin.guard";
import {
  AdminRequestDetailDto,
  AdminRequestListQueryDto,
  AdminRequestPageDto,
  AdminRequestStatusDto,
  UpdateAdminRequestStatusDto,
} from "./admin-requests.dto";
import { AdminRequestsService } from "./admin-requests.service";

@ApiTags("administration")
@ApiCookieAuth("session")
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@ApiResponse({ status: 422, type: ApiErrorDto })
@ApiResponse({ status: 503, type: ApiErrorDto })
@UseGuards(SessionGuard, AdminGuard)
@Controller("api/v1/admin/requests")
export class AdminRequestsController {
  constructor(private readonly requests: AdminRequestsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "listAdminRequests" })
  @ApiResponse({ status: 200, type: AdminRequestPageDto })
  list(@Query() query: AdminRequestListQueryDto): Promise<AdminRequestPageDto> {
    return this.requests.list(query.after);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getAdminRequest" })
  @ApiResponse({ status: 200, type: AdminRequestDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  detail(
    @Param() params: ProjectIdDto,
    @Query() query: Record<string, unknown>,
  ): Promise<AdminRequestDetailDto> {
    rejectUnknownQuery(query);
    return this.requests.detail(params.id);
  }

  @Patch(":id/status")
  @Header("Cache-Control", "no-store")
  @UseGuards(JsonOriginGuard, CsrfGuard)
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOperation({ operationId: "updateAdminRequestStatus" })
  @ApiResponse({ status: 200, type: AdminRequestStatusDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "REQUEST_STATE_CONFLICT",
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Body() input: UpdateAdminRequestStatusDto,
    @Query() query: Record<string, unknown>,
  ): Promise<AdminRequestStatusDto> {
    rejectUnknownQuery(query);
    return this.requests.updateStatus(
      requireActor(request).id,
      params.id,
      input,
    );
  }
}
