import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty } from "@nestjs/swagger";

class HealthResponseDto {
  @ApiProperty({ enum: ["ok"] }) status!: "ok";
}

@Controller()
export class HealthController {
  @Get("health")
  @ApiOperation({ operationId: "getHealth" })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): { status: "ok" } {
    return { status: "ok" };
  }
}
