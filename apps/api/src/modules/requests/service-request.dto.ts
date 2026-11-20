import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  Equals,
  IsBoolean,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { normalizePhone, trimContact } from "./contact-input";

export class CreateServiceRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => trimContact(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[^\p{Cc}\p{Cs}\u2028\u2029]+$/u)
  contactName!: string;

  @ApiProperty({
    pattern: "^\\+[1-9]\\d{6,14}$",
    example: "+79991234567",
    description:
      "Normalized + and 7–15 digits; spaces/brackets/dashes accepted on input",
  })
  @Transform(({ value }: { value: unknown }) => normalizePhone(value))
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/)
  phone!: string;

  @ApiProperty({ enum: ["TELEGRAM", "MAX", "VK"] })
  @IsIn(["TELEGRAM", "MAX", "VK"])
  contactChannel!: "TELEGRAM" | "MAX" | "VK";

  @ApiProperty({
    minLength: 1,
    maxLength: 200,
    description:
      "Handle or profile link as plain text; no messenger account verification or automatic navigation",
  })
  @Transform(({ value }: { value: unknown }) => trimContact(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[^\p{Cc}\p{Cs}\u2028\u2029<>]+$/u)
  contactValue!: string;

  @ApiProperty({
    type: Boolean,
    enum: [true],
    description:
      "Technical acceptance of contact-processing notice; legal launch review remains required",
  })
  @IsBoolean()
  @Equals(true)
  privacyConsent!: boolean;
}

export class ServiceRequestReceiptDto {
  @ApiProperty({ format: "uuid" }) requestId!: string;
  @ApiProperty({
    enum: ["RECEIVED"],
    description: "Original receipt, not the current operator workflow status",
  })
  status!: "RECEIVED";
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}
