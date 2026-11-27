import { ApiExtraModels, ApiProperty, PickType } from "@nestjs/swagger";
import { IsInt, IsObject, IsString, IsUUID, Max, Min } from "class-validator";
import { GardenDraftDto } from "../templates/garden/garden-content.dto";
import {
  templateContentModels,
  templateContentSchema,
  type TemplateContent,
} from "../templates/template-content";

export class CreateProjectDto extends PickType(GardenDraftDto, [
  "title",
] as const) {
  @ApiProperty({ example: "wedding-garden-v1" })
  @IsString()
  templateVersionId!: string;
}

@ApiExtraModels(...templateContentModels)
export class SaveProjectDraftDto extends PickType(GardenDraftDto, [
  "title",
] as const) {
  @ApiProperty(templateContentSchema)
  @IsObject()
  content!: unknown;

  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483646, example: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  expectedRevision!: number;
}

export class ProjectIdDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  id!: string;
}

export class ProjectSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ example: "wedding-garden-v1" }) templateVersionId!: string;
  @ApiProperty({ maxLength: 24 }) title!: string;
  @ApiProperty({ type: Number, minimum: 1 }) revision!: number;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  firstPublishedAt!: string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty({
    description: "Draft capability only, not permission to publish",
  })
  canEditDraft!: boolean;
}

@ApiExtraModels(...templateContentModels)
export class ProjectDto extends ProjectSummaryDto {
  @ApiProperty(templateContentSchema) content!: TemplateContent;
}

export class ProjectListDto {
  @ApiProperty({ type: [ProjectSummaryDto] }) items!: ProjectSummaryDto[];
}
