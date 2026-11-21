import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { ProjectPhotoStatus } from "../../database/generated/client";
import { ProjectIdDto } from "../projects/project.dto";

export class PhotoIdDto extends ProjectIdDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  photoId!: string;
}

export class ProjectPhotoDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ProjectPhotoStatus }) status!: ProjectPhotoStatus;
  @ApiProperty({ type: "integer", minimum: 1 }) width!: number;
  @ApiProperty({ type: "integer", minimum: 1 }) height!: number;
  @ApiProperty({ type: "integer", minimum: 1 }) byteSize!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}

export class ProjectPhotoListDto {
  @ApiProperty({ type: [ProjectPhotoDto] }) items!: ProjectPhotoDto[];
}
