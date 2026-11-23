import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import type { RsvpAttendance } from "../../database/generated/client";
import { RSVP_ATTENDANCE } from "./rsvp-form";

export class RsvpDashboardQueryDto {
  @ApiPropertyOptional({ enum: RSVP_ATTENDANCE })
  @IsOptional()
  @IsIn(RSVP_ATTENDANCE)
  attendance?: RsvpAttendance;
}

class RsvpDashboardRowDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: RSVP_ATTENDANCE }) attendance!: RsvpAttendance;
  @ApiProperty({ type: "integer" }) companions!: number;
  @ApiProperty({ format: "date-time" }) receivedAt!: string;
}

class RsvpDashboardCountsDto {
  @ApiProperty({ type: "integer" }) total!: number;
  @ApiProperty({ type: "integer" }) yes!: number;
  @ApiProperty({ type: "integer" }) no!: number;
  @ApiProperty({ type: "integer" }) companions!: number;
}

export class RsvpDashboardDto {
  @ApiProperty({ type: RsvpDashboardCountsDto })
  counts!: RsvpDashboardCountsDto;
  @ApiProperty({ type: [RsvpDashboardRowDto] }) items!: RsvpDashboardRowDto[];
}
