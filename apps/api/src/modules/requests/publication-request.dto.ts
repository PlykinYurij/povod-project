import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsUUID, Max, Min, ValidateIf } from "class-validator";
import { TemplatePriceDto } from "../templates/template-catalog.dto";
import { CreateServiceRequestDto } from "./service-request.dto";

export class CreatePublicationRequestDto extends CreateServiceRequestDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @IsUUID()
  projectId!: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  expectedRevision!: number;

  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: 2147483647,
    nullable: true,
  })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  expectedPriceVersion!: number | null;
}

export class ActivePublicationRequestDto {
  @ApiProperty({ format: "uuid" }) requestId!: string;
  @ApiProperty({ enum: ["ASSISTANCE", "PUBLICATION"] }) kind!:
    "ASSISTANCE" | "PUBLICATION";
  @ApiProperty({ enum: ["NEW", "IN_PROGRESS"] }) status!: "NEW" | "IN_PROGRESS";
  @ApiProperty({ type: "integer", minimum: 1 }) requestVersion!: number;
  @ApiProperty({ type: "integer", minimum: 1, nullable: true })
  submittedRevision!: number | null;
  @ApiProperty({ type: "integer", minimum: 1 }) currentProjectRevision!: number;
  @ApiProperty({ type: TemplatePriceDto, nullable: true })
  price!: TemplatePriceDto | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}

export class ProjectPublicationRequestDto {
  @ApiProperty({ type: TemplatePriceDto, nullable: true })
  currentPrice!: TemplatePriceDto | null;
  @ApiProperty({ type: ActivePublicationRequestDto, nullable: true })
  request!: ActivePublicationRequestDto | null;

  @ApiProperty({ type: () => ClosedPublicationRequestDto, nullable: true })
  lastClosed!: ClosedPublicationRequestDto | null;
}

export class ClosedPublicationRequestDto {
  @ApiProperty({ format: "uuid" }) requestId!: string;
  @ApiProperty({ enum: ["COMPLETED", "REJECTED", "CANCELLED"] })
  status!: "COMPLETED" | "REJECTED" | "CANCELLED";
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
