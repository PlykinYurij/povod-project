import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import {
  ContactChannel,
  ServiceRequestKind,
  ServiceRequestStatus,
} from "../../database/generated/client";
import { ProjectDto } from "../projects/project.dto";
import { TemplatePriceDto } from "../templates/template-catalog.dto";

export class AdminRequestListQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  after?: string;
}

export class AdminRequestSummaryDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ServiceRequestKind })
  kind!: ServiceRequestKind;

  @ApiProperty({ enum: ServiceRequestStatus })
  status!: ServiceRequestStatus;

  @ApiProperty({ type: String, nullable: true })
  templateId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  projectTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  userName!: string | null;

  @ApiProperty()
  hasAccount!: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}

export class AdminRequestPageDto {
  @ApiProperty({ type: [AdminRequestSummaryDto] })
  items!: AdminRequestSummaryDto[];

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  next!: string | null;
}

export class AdminRequestDetailDto extends AdminRequestSummaryDto {
  @ApiProperty()
  contactName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ enum: ContactChannel })
  contactChannel!: ContactChannel;

  @ApiProperty()
  contactValue!: string;

  @ApiProperty({ type: Number, nullable: true })
  submittedRevision!: number | null;

  @ApiProperty({ type: TemplatePriceDto, nullable: true })
  quotedPrice!: TemplatePriceDto | null;

  @ApiProperty({ type: ProjectDto, nullable: true })
  project!: ProjectDto | null;
}
