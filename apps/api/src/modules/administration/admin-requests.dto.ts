import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import {
  ContactChannel,
  ServiceRequestKind,
  ServiceRequestStatus,
} from "../../database/generated/client";
import { ProjectDto } from "../projects/project.dto";
import { PublicationReceiptDto } from "../publication/publish-request.dto";
import { PublicationLifecycleDto } from "../publication/unpublish-project.dto";
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
  @ApiProperty({ type: "integer", minimum: 1 })
  requestVersion!: number;
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

  @ApiProperty({ type: PublicationReceiptDto, nullable: true })
  publication!: PublicationReceiptDto | null;

  @ApiProperty({ type: PublicationLifecycleDto, nullable: true })
  publicationLifecycle!: PublicationLifecycleDto | null;
}

const targets = ["IN_PROGRESS", "REJECTED"] as const;

export class AdminRequestStatusDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ServiceRequestStatus }) status!: ServiceRequestStatus;
  @ApiProperty({ type: "integer", minimum: 1 }) requestVersion!: number;
}

export class UpdateAdminRequestStatusDto {
  @ApiProperty({ enum: targets })
  @IsIn(targets)
  status!: (typeof targets)[number];

  @ApiProperty({ type: "integer", minimum: 1, maximum: 2147483646 })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  expectedVersion!: number;
}
