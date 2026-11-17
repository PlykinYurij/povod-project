import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

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
    description:
      "At least one Unicode uppercase letter, decimal digit and punctuation/symbol. Whitespace is allowed but is not a special character.",
  })
  @IsString()
  @Length(8, 128)
  @Matches(/\p{Lu}/u)
  @Matches(/\p{Nd}/u)
  @Matches(/[\p{P}\p{S}]/u)
  password!: string;
}

export class RegisteredUserDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "email" }) email!: string;
}
export class RegisterResponseDto {
  @ApiProperty({ type: RegisteredUserDto }) user!: RegisteredUserDto;
}
