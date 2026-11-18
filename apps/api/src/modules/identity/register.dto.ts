import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { StrongPassword } from "./password-validation";

export class RegisterDto {
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
}
export class RegisterResponseDto {
  @ApiProperty({ type: RegisteredUserDto }) user!: RegisteredUserDto;
}
