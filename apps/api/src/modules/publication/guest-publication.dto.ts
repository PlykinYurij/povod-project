import { ApiProperty } from "@nestjs/swagger";
import { GardenContentDto } from "../templates/garden/garden-content.dto";

export class GuestCoverDto {
  @ApiProperty({ type: "integer" }) width!: number;
  @ApiProperty({ type: "integer" }) height!: number;
}

export class GuestPublicationDto {
  @ApiProperty({ enum: ["wedding-garden-v1"] })
  templateVersionId!: "wedding-garden-v1";
  @ApiProperty({ format: "uuid" }) snapshotId!: string;
  @ApiProperty({ type: GardenContentDto }) content!: GardenContentDto;
  @ApiProperty({ type: GuestCoverDto, nullable: true })
  cover!: GuestCoverDto | null;
}
