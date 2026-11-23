import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Matches, Max, Min } from "class-validator";
import { PUBLICATION_SLUG } from "./publication-address";
import type { PublicationReceipt } from "../../database/generated/client";

const MAX_DB_VERSION = 2_147_483_647;

export class PublishRequestDto {
  @ApiProperty({ type: "integer", minimum: 1, maximum: MAX_DB_VERSION })
  @IsInt()
  @Min(1)
  @Max(MAX_DB_VERSION)
  expectedRequestVersion!: number;

  @ApiProperty({ type: "integer", minimum: 1, maximum: MAX_DB_VERSION })
  @IsInt()
  @Min(1)
  @Max(MAX_DB_VERSION)
  expectedProjectRevision!: number;

  @ApiProperty({ type: "integer", minimum: 1, maximum: MAX_DB_VERSION })
  @IsInt()
  @Min(1)
  @Max(MAX_DB_VERSION)
  expectedPriceVersion!: number;

  @ApiProperty({
    minLength: 3,
    maxLength: 63,
    pattern: PUBLICATION_SLUG.source,
  })
  @IsString()
  @Matches(PUBLICATION_SLUG)
  slug!: string;
}

export class PublicationReceiptDto {
  @ApiProperty({ format: "uuid" })
  publicationId!: string;

  @ApiProperty({ format: "uuid" })
  snapshotId!: string;

  @ApiProperty({ format: "uri" })
  url!: string;

  @ApiProperty({ type: "integer" })
  requestVersion!: number;

  @ApiProperty({ format: "date-time" })
  publishedAt!: string;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;
}

export const receiptFields = {
  publicationId: true,
  snapshotId: true,
  url: true,
  requestVersion: true,
  publishedAt: true,
  expiresAt: true,
} as const;

export function toPublicationReceipt(
  row: Pick<PublicationReceipt, keyof typeof receiptFields>,
): PublicationReceiptDto {
  return {
    publicationId: row.publicationId,
    snapshotId: row.snapshotId,
    url: row.url,
    requestVersion: row.requestVersion,
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}
