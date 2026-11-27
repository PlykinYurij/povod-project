import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class ResumeProjectDto {
  @ApiProperty({ type: "integer", minimum: 1, maximum: 2_147_483_647 })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedProjectRevision!: number;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 2_147_483_647 })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedPublicationVersion!: number;

}

export class ResumeReceiptDto {
  @ApiProperty({ format: "uuid" }) publicationId!: string;
  @ApiProperty({ type: Number }) publicationVersion!: number;
  @ApiProperty({ enum: ["PUBLISHED"] }) status!: "PUBLISHED";
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: string;
  @ApiProperty({ type: Number, nullable: true }) remainingMs!: null;
}
