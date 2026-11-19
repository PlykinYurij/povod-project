import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { StrongPassword } from "./password-validation";

export class RegisterDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 80,
    example: "Андрей",
    description:
      "Name for addressing the owner; trimmed, not unique. No control characters.",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[^\x00-\x1f\x7f-\x9f\u2028\u2029]+$/)
  displayName!: string;

  @ApiProperty({
    format: "email",
    maxLength: 254,
    example: "owner@example.test",
    description: "Trimmed, case-insensitive; dots and plus tags preserved",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsEmail({ require_tld: true })
  @MaxLength(254)
  email!: string;

  @StrongPassword()
  password!: string;
}

export class RegisteredUserDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 80,
    description: "May be null for an existing account",
  })
  displayName!: string | null;
}
export class RegisterResponseDto {
  @ApiProperty({ type: RegisteredUserDto }) user!: RegisteredUserDto;
}
