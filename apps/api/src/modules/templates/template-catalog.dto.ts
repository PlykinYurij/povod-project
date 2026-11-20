import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

export class TemplateCatalogQueryDto {
  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @IsOptional()
  @IsIn(["ru", "en"])
  locale?: "ru" | "en";
}

export class TemplatePaletteDto {
  @ApiProperty({ example: "sage" }) id!: string;
  @ApiProperty({ example: "Шалфей" }) title!: string;
}

export class TemplateBlockDto {
  @ApiProperty({ example: "program" }) id!: string;
  @ApiProperty({ description: "Whether the content block is mandatory" })
  required!: boolean;
}

export class TemplateSummaryDto {
  @ApiProperty({ example: "wedding-garden-v1" }) templateVersionId!: string;
  @ApiProperty({ example: "Тихий сад" }) title!: string;
  @ApiProperty({ enum: ["wedding"], example: "wedding" }) eventType!: "wedding";
  @ApiProperty({
    type: Number,
    example: 1,
    minimum: 1,
    description:
      "Content version identifier; not a publication-readiness promise",
  })
  schemaVersion!: number;
  @ApiProperty({ type: [TemplatePaletteDto] }) themes!: TemplatePaletteDto[];
  @ApiProperty({
    type: [TemplateBlockDto],
    description: "Fixed display order, not drag-and-drop",
  })
  blocks!: TemplateBlockDto[];
  @ApiProperty({
    example: "/templates/quiet-garden",
    description: "Relative local demo page",
  })
  demoPath!: string;
  @ApiProperty({
    example: "/templates/quiet-garden/garden.svg",
    description: "Public code-owned illustration, not a private media object",
  })
  previewImagePath!: string;
}

export class TemplateCatalogDto {
  @ApiProperty({
    type: [TemplateSummaryDto],
    description:
      "Only implemented templates; no synthetic placeholders for future catalog entries",
  })
  items!: TemplateSummaryDto[];
}
