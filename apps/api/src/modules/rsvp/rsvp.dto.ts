import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import {
  RSVP_ATTENDANCE,
  RSVP_MAX_COMPANIONS,
  RSVP_NAME_MAX_LENGTH,
} from "./rsvp-form";

export class SubmitRsvpDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  formVersionId!: string;

  @ApiProperty({ minLength: 1, maxLength: RSVP_NAME_MAX_LENGTH })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(1, RSVP_NAME_MAX_LENGTH)
  @Matches(/^[^\p{Cc}\p{Cs}]+$/u)
  name!: string;

  @ApiProperty({ enum: RSVP_ATTENDANCE })
  @IsIn(RSVP_ATTENDANCE)
  attendance!: (typeof RSVP_ATTENDANCE)[number];

  @ApiProperty({
    type: "integer",
    minimum: 0,
    maximum: RSVP_MAX_COMPANIONS,
    description: "Must be zero when attendance is no",
  })
  @IsInt()
  @Min(0)
  @Max(RSVP_MAX_COMPANIONS)
  companions!: number;
}

export class PublicRsvpFormDto {
  @ApiProperty({ format: "uuid" })
  formVersionId!: string;

  @ApiProperty({ enum: ["garden-v1"] })
  schema!: "garden-v1";

  @ApiProperty({ type: "integer", example: RSVP_NAME_MAX_LENGTH })
  nameMaxLength!: number;

  @ApiProperty({ type: "integer", example: RSVP_MAX_COMPANIONS })
  maxCompanions!: number;
}

export class RsvpReceiptDto {
  @ApiProperty({ format: "uuid" })
  responseId!: string;

  @ApiProperty({ format: "date-time" })
  receivedAt!: string;
}
