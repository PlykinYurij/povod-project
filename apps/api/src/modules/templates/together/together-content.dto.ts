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

export const TOGETHER_TEMPLATE_VERSION_ID = "wedding-together-v1";

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

export class TogetherCopyDto {
  @Text(80) heroLabel!: string;
  @Text(16) separator!: string;
  @Text(4000) intro!: string;
  @Text(160) eventHeading!: string;
  @Text(80) dateLabel!: string;
  @Text(80) venueLabel!: string;
  @Text(160) photoHeading!: string;
  @Text(160) rsvpHeading!: string;
  @Text(4000) rsvpIntro!: string;
  @Text(80) rsvpAction!: string;
  @Text(1000) signoff!: string;
}

export class TogetherNamesDto {
  @Text(20) first!: string;
  @Text(20) second!: string;
}

export class TogetherEventDto {
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

export class TogetherVenueDto {
  @Text(80) name!: string;
  @Text(150) address!: string;
}

export class TogetherPhotoDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  mediaId!: string | null;

  @Text(200) alt!: string;
}

export class TogetherNoteDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  enabled!: boolean;

  @Text(160) heading!: string;
  @Text(1000) body!: string;
}

export class TogetherContentDto {
  @ApiProperty({ enum: ["ru", "en"] })
  @IsIn(["ru", "en"])
  locale!: "ru" | "en";

  @Section(TogetherNamesDto) names!: TogetherNamesDto;
  @Section(TogetherEventDto) event!: TogetherEventDto;
  @Section(TogetherVenueDto) venue!: TogetherVenueDto;
  @Section(TogetherPhotoDto) photo!: TogetherPhotoDto;
  @Section(TogetherNoteDto) note!: TogetherNoteDto;
  @Section(TogetherCopyDto) copy!: TogetherCopyDto;
}

export class TogetherDraftDto {
  @ApiProperty({ enum: [TOGETHER_TEMPLATE_VERSION_ID] })
  @IsIn([TOGETHER_TEMPLATE_VERSION_ID])
  templateVersionId!: typeof TOGETHER_TEMPLATE_VERSION_ID;

  @Text(24) title!: string;
  @Section(TogetherContentDto) content!: TogetherContentDto;
}
