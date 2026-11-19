import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

// Absolute end check rejects a final newline, which JavaScript's $ can allow.
const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,128}(?![\s\S])/;

export function StrongPassword(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      minLength: 8,
      maxLength: 128,
      writeOnly: true,
      format: "password",
      pattern: PASSWORD_PATTERN.source,
      description:
        "8–128 characters: Latin letters, digits and punctuation. Requires an uppercase letter, digit and special character. No spaces or other whitespace. No trimming. Existing-password login is unchanged.",
    }),
    IsString(),
    Length(8, 128),
    Matches(PASSWORD_PATTERN),
  );
}
