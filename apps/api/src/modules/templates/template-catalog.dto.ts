import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class TemplateCatalogQueryDto {
  @ApiPropertyOptional({ enum: ["ru", "en"], default: "ru" })
  @IsOptional()
  @IsIn(["ru", "en"])
  locale?: "ru" | "en";

  @ApiPropertyOptional({
    maxLength: 64,
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    example: "wedding",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  category?: string;
}

export class TemplateCategoryDto {
  @ApiProperty({ example: "wedding", maxLength: 64 }) id!: string;
  @ApiProperty({ example: "Свадьба", maxLength: 80 }) title!: string;
}

export class TemplatePriceDto {
  @ApiProperty({ type: "integer", minimum: 0, maximum: 2147483647 })
  amountMinor!: number;
  @ApiProperty({ enum: ["RUB"] }) currency!: "RUB";
  @ApiProperty({ type: "integer", minimum: 1 }) version!: number;
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
  @ApiProperty({ example: "quiet-garden" }) templateId!: string;
  @ApiProperty({ example: "wedding" }) categoryId!: string;
  @ApiProperty({
    type: TemplatePriceDto,
    nullable: true,
    description: "NULL means price not configured, not a free offer",
  })
  price!: TemplatePriceDto | null;
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
  @ApiProperty({ type: [TemplateCategoryDto] })
  categories!: TemplateCategoryDto[];
  @ApiProperty({
    type: [TemplateSummaryDto],
    description:
      "Only implemented templates; no synthetic placeholders for future catalog entries",
  })
  items!: TemplateSummaryDto[];
}
