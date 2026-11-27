import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Type, type ClassConstructor } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { IsGardenValue } from "../garden/content-constraints";

export const ANNIVERSARY_TEMPLATE_VERSION_ID = "birthday-anniversary-v1";

function Text(maxLength: number): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ type: String, maxLength }),
    IsString(),
    MaxLength(maxLength),
  );
}

function Section(type: ClassConstructor<object>): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ type }),
    IsDefined(),
    IsObject(),
    ValidateNested(),
    Type(() => type),
  );
}

export class AnniversaryCopyDto {
  @Text(80) eyebrow!: string;
  @Text(4000) letter!: string;
  @Text(80) dateLabel!: string;
  @Text(160) placeHeading!: string;
  @Text(160) photoHeading!: string;
  @Text(240) caption!: string;
  @Text(160) noteHeading!: string;
  @Text(160) rsvpHeading!: string;
  @Text(4000) rsvpIntro!: string;
  @Text(80) rsvpAction!: string;
  @Text(1000) signoff!: string;
}

export class AnniversaryEventDto {
  @Text(10) @IsGardenValue("date") date!: string;
  @Text(5) @IsGardenValue("time") startTime!: string;
  @ApiProperty({
    type: String,
    description: "Named IANA time zone, or empty in a draft",
  })
  @IsString()
  @IsGardenValue("zone")
  timeZone!: string;
}

export class AnniversaryVenueDto {
  @Text(80) name!: string;
  @Text(150) address!: string;
}

export class AnniversaryPhotoDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  mediaId!: string | null;

  @Text(200) alt!: string;
}

export class AnniversaryNoteDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  enabled!: boolean;

  @Text(1000) text!: string;
}

export class AnniversaryContentDto {
  @ApiProperty({ enum: ["ru", "en"] })
  @IsIn(["ru", "en"])
  locale!: "ru" | "en";

  @Text(20) celebrant!: string;
  @Section(AnniversaryEventDto) event!: AnniversaryEventDto;
  @Section(AnniversaryVenueDto) venue!: AnniversaryVenueDto;
  @Section(AnniversaryPhotoDto) photo!: AnniversaryPhotoDto;
  @Section(AnniversaryNoteDto) note!: AnniversaryNoteDto;
  @Section(AnniversaryCopyDto) copy!: AnniversaryCopyDto;
}

export class AnniversaryDraftDto {
  @ApiProperty({ enum: [ANNIVERSARY_TEMPLATE_VERSION_ID] })
  @IsIn([ANNIVERSARY_TEMPLATE_VERSION_ID])
  templateVersionId!: typeof ANNIVERSARY_TEMPLATE_VERSION_ID;

  @Text(24) title!: string;
  @Section(AnniversaryContentDto) content!: AnniversaryContentDto;
}
