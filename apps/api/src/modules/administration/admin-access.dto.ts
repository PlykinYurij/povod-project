import { ApiProperty } from "@nestjs/swagger";

export class AdminAccessDto {
  @ApiProperty({ enum: ["ADMIN"], description: "Current server-verified role" })
  role!: "ADMIN";
}
