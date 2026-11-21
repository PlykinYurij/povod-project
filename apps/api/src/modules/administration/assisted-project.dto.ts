import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";
import { CreateProjectDto } from "../projects/project.dto";

export class CreateAssistedProjectDto extends CreateProjectDto {
  @ApiProperty({ type: "integer", minimum: 1, maximum: 2147483646 })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  expectedRequestVersion!: number;
}
