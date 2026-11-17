import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// Absolute end check also rejects a final newline, which JavaScript's $ can allow.
const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9 ])[\x20-\x7E]{8,128}(?![\s\S])/;

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

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
    format: "password",
    pattern: PASSWORD_PATTERN.source,
    description:
      "Printable ASCII only: A-Z/a-z, 0-9, punctuation and space. Requires an uppercase letter, digit and special character; space is not a special character. No trimming.",
  })
  @IsString()
  @Length(8, 128)
  @Matches(PASSWORD_PATTERN)
  password!: string;
}

export class RegisteredUserDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "email" }) email!: string;
}
export class RegisterResponseDto {
  @ApiProperty({ type: RegisteredUserDto }) user!: RegisteredUserDto;
}
