import { ApiExtraModels, ApiProperty } from "@nestjs/swagger";
import {
  TEMPLATE_VERSION_IDS,
  templateContentModels,
  templateContentSchema,
  type TemplateContent,
} from "../templates/template-content";
import { PublicRsvpFormDto } from "../rsvp/rsvp.dto";

export class GuestCoverDto {
  @ApiProperty({ type: "integer" }) width!: number;
  @ApiProperty({ type: "integer" }) height!: number;
}

@ApiExtraModels(...templateContentModels)
export class GuestPublicationDto {
  @ApiProperty({ enum: TEMPLATE_VERSION_IDS })
  templateVersionId!: (typeof TEMPLATE_VERSION_IDS)[number];
  @ApiProperty({ format: "uuid" }) snapshotId!: string;
  @ApiProperty(templateContentSchema) content!: TemplateContent;
  @ApiProperty({ type: GuestCoverDto, nullable: true })
  cover!: GuestCoverDto | null;
  @ApiProperty({ type: PublicRsvpFormDto })
  rsvp!: PublicRsvpFormDto;
}
