import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { IsGardenValue } from "./content-constraints";

function Text(maxLength: number): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ type: String, maxLength }),
    IsString(),
    MaxLength(maxLength),
  );
}

export class GardenCopyDto {
  @Text(80) invitationLabel!: string;
  @Text(16) namesConnector!: string;
  @Text(4000) introduction!: string;
  @Text(160) detailsTitle!: string;
  @Text(80) whenLabel!: string;
  @Text(80) whereLabel!: string;
  @Text(80) startTimeLabel!: string;
  @Text(80) timeZoneLabel!: string;
  @Text(80) routeLabel!: string;
  @Text(80) programEyebrow!: string;
  @Text(160) programTitle!: string;
  @Text(80) rsvpEyebrow!: string;
  @Text(160) rsvpTitle!: string;
  @Text(1000) footerText!: string;
}

export class GardenNamesDto {
  @Text(20) first!: string;
  @Text(20) second!: string;
}

export class GardenEventDto {
  @Text(10) @IsGardenValue("date") localDate!: string;
  @Text(5) @IsGardenValue("time") localTime!: string;
  @ApiProperty({
    type: String,
    description: "Named IANA time zone, or empty in a draft",
  })
  @IsString()
  @IsGardenValue("zone")
  timeZone!: string;
}

export class GardenVenueDto {
  @Text(80) name!: string;
  @Text(150) address!: string;
  @ApiProperty({
    type: String,
    maxLength: 200,
    nullable: true,
    description: "HTTPS without credentials; empty draft value allowed",
  })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(200)
  @IsGardenValue("route")
  routeUrl!: string | null;
}

export class GardenProgramItemDto {
  @Text(5) @IsGardenValue("time") time!: string;
  @Text(200) text!: string;
}

export class GardenContentDto {
  @ApiProperty({ enum: ["ru", "en"] }) @IsIn(["ru", "en"]) locale!: "ru" | "en";
  @ApiProperty({ enum: ["sage", "sand"] }) @IsIn(["sage", "sand"]) themeId!:
    "sage" | "sand";
  @ApiProperty({ type: GardenCopyDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => GardenCopyDto)
  copy!: GardenCopyDto;
  @ApiProperty({ type: GardenNamesDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => GardenNamesDto)
  names!: GardenNamesDto;
  @ApiProperty({ type: GardenEventDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => GardenEventDto)
  event!: GardenEventDto;
  @ApiProperty({ type: GardenVenueDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => GardenVenueDto)
  venue!: GardenVenueDto;
  @ApiProperty({
    type: [GardenProgramItemDto],
    nullable: true,
    maxItems: 12,
    description: "null disables the block; an empty draft array is allowed",
  })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GardenProgramItemDto)
  program!: GardenProgramItemDto[] | null;
  @ApiProperty({
    type: String,
    format: "uuid",
    nullable: true,
    description:
      "Reference only; readiness/ownership require a later media use case",
  })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  heroMediaId!: string | null;
}

/** Whole-content input for future draft use cases, not an implemented HTTP route. */
export class GardenDraftDto {
  @ApiProperty({ enum: ["wedding-garden-v1"] })
  @IsIn(["wedding-garden-v1"])
  templateVersionId!: "wedding-garden-v1";
  @Text(24) title!: string;
  @ApiProperty({ type: GardenContentDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => GardenContentDto)
  content!: GardenContentDto;
}
