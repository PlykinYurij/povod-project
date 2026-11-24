import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import type { PublicationUnpublishReceipt } from "../../database/generated/client";
import {
  publicationStatus,
  type PublicationLifecycle,
} from "./publication-lifecycle";

const modeValues = ["PAUSE_PERIOD", "KEEP_RUNNING"] as const;
const statusValues = ["PUBLISHED", "PAUSED", "UNPUBLISHED", "EXPIRED"] as const;
const removedStatuses = ["PAUSED", "UNPUBLISHED"] as const;

export class UnpublishProjectDto {
  @ApiProperty({ type: "integer", minimum: 1, maximum: 2_147_483_647 })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedProjectRevision!: number;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 2_147_483_647 })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedPublicationVersion!: number;

  @ApiProperty({ enum: modeValues })
  @IsIn(modeValues)
  mode!: (typeof modeValues)[number];

  @ApiProperty({ minLength: 1, maxLength: 240 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 240)
  @Matches(/^[^\p{Cc}\p{Cs}]+$/u)
  reason!: string;
}

class PublicationTimingDto {
  @ApiProperty({ format: "uuid" }) publicationId!: string;
  @ApiProperty({ type: "integer" }) publicationVersion!: number;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  expiresAt!: string | null;
  @ApiProperty({ type: Number, nullable: true }) remainingMs!: number | null;
}

export class PublicationLifecycleDto extends PublicationTimingDto {
  @ApiProperty({ enum: statusValues }) status!: (typeof statusValues)[number];
}

export class UnpublishReceiptDto extends PublicationTimingDto {
  @ApiProperty({ enum: removedStatuses })
  status!: (typeof removedStatuses)[number];
}

function publicationTiming(expiresAt: Date, pausedAt: Date | null) {
  return {
    expiresAt: pausedAt ? null : expiresAt.toISOString(),
    remainingMs: pausedAt ? expiresAt.getTime() - pausedAt.getTime() : null,
  };
}

export function mapPublicationLifecycle(
  row: PublicationLifecycle,
  now: Date,
): PublicationLifecycleDto {
  return {
    publicationId: row.id,
    publicationVersion: row.version,
    status: publicationStatus(row, now),
    ...publicationTiming(row.expiresAt, row.pausedAt),
  };
}

export function mapUnpublishReceipt(
  row: PublicationUnpublishReceipt,
): UnpublishReceiptDto {
  return {
    publicationId: row.publicationId,
    publicationVersion: row.publicationVersion,
    status: row.pausedAt ? "PAUSED" : "UNPUBLISHED",
    ...publicationTiming(row.expiresAt, row.pausedAt),
  };
}
