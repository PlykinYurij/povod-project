import { Controller, Get, Header, Query } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GardenDraftDto } from "./garden/garden-content.dto";
import { ApiErrorDto } from "../../http/api-error";
import {
  TemplateCatalogDto,
  TemplateCatalogQueryDto,
} from "./template-catalog.dto";
import { TemplateCatalogService } from "./template-catalog.service";

@ApiTags("templates")
@ApiExtraModels(GardenDraftDto)
@Controller("api/v1/templates")
export class TemplateCatalogController {
  constructor(private readonly catalog: TemplateCatalogService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    operationId: "getTemplateCatalog",
    summary:
      "Public catalog with categories and versioned prices; account not required",
  })
  @ApiResponse({ status: 200, type: TemplateCatalogDto })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: "SERVICE_UNAVAILABLE",
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description: "VALIDATION_FAILED: invalid locale or unknown query field",
  })
  list(@Query() query: TemplateCatalogQueryDto): Promise<TemplateCatalogDto> {
    return this.catalog.list(query);
  }
}
