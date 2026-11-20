import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ApiErrorDto } from "../../http/api-error";
import { SessionGuard } from "../identity/session.guard";
import { AdminAccessDto } from "./admin-access.dto";
import { AdminGuard } from "./admin.guard";

@ApiTags("administration")
@ApiCookieAuth("session")
@UseGuards(SessionGuard, AdminGuard)
@Controller("api/v1/admin")
export class AdministrationController {
  @Get("access")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    operationId: "getAdminAccess",
    summary: "Verify access before opening private operator screens",
  })
  @ApiResponse({ status: 200, type: AdminAccessDto })
  @ApiResponse({ status: 401, type: ApiErrorDto, description: "AUTH_REQUIRED" })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: "ADMIN_REQUIRED",
  })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: "SERVICE_UNAVAILABLE",
  })
  access(): AdminAccessDto {
    return { role: "ADMIN" };
  }
}
