import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

// Absolute end check rejects a final newline, which JavaScript's $ can allow.
const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9 ])[\x20-\x7E]{8,128}(?![\s\S])/;

export function StrongPassword(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      minLength: 8, maxLength: 128, writeOnly: true, format: "password",
      pattern: PASSWORD_PATTERN.source,
      description: "Printable ASCII only: A-Z/a-z, 0-9, punctuation and space. Requires an uppercase letter, digit and special character; space is not a special character. No trimming.",
    }),
    IsString(), Length(8, 128), Matches(PASSWORD_PATTERN),
  );
}
