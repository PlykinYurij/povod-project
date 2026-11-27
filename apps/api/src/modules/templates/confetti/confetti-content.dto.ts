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

export const CONFETTI_TEMPLATE_VERSION_ID = "birthday-confetti-v1";

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

export class ConfettiCopyDto {
  @Text(80) invitationLabel!: string;
  @Text(4000) intro!: string;
  @Text(160) whenHeading!: string;
  @Text(160) whereHeading!: string;
  @Text(80) dateLabel!: string;
  @Text(80) timeLabel!: string;
  @Text(160) photoHeading!: string;
  @Text(160) rsvpHeading!: string;
  @Text(4000) rsvpIntro!: string;
  @Text(80) rsvpAction!: string;
  @Text(1000) signoff!: string;
}

export class ConfettiEventDto {
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

export class ConfettiVenueDto {
  @Text(80) name!: string;
  @Text(150) address!: string;
}

export class ConfettiPhotoDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  mediaId!: string | null;

  @Text(200) alt!: string;
}

export class ConfettiNoteDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  enabled!: boolean;

  @Text(160) heading!: string;
  @Text(1000) body!: string;
}

export class ConfettiContentDto {
  @ApiProperty({ enum: ["ru", "en"] })
  @IsIn(["ru", "en"])
  locale!: "ru" | "en";

  @Text(20) celebrantName!: string;
  @Section(ConfettiEventDto) event!: ConfettiEventDto;
  @Section(ConfettiVenueDto) venue!: ConfettiVenueDto;
  @Section(ConfettiPhotoDto) photo!: ConfettiPhotoDto;
  @Section(ConfettiNoteDto) note!: ConfettiNoteDto;
  @Section(ConfettiCopyDto) copy!: ConfettiCopyDto;
}

export class ConfettiDraftDto {
  @ApiProperty({ enum: [CONFETTI_TEMPLATE_VERSION_ID] })
  @IsIn([CONFETTI_TEMPLATE_VERSION_ID])
  templateVersionId!: typeof CONFETTI_TEMPLATE_VERSION_ID;

  @Text(24) title!: string;
  @Section(ConfettiContentDto) content!: ConfettiContentDto;
}
