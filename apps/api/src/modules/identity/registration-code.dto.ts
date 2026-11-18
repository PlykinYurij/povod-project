import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, Matches } from "class-validator";

export class RegistrationIdDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  registrationId!: string;
}
const CODE_PATTERN = /^[0-9]{6}(?![\s\S])/;
export class ConfirmRegistrationDto extends RegistrationIdDto {
  @ApiProperty({ writeOnly: true, pattern: CODE_PATTERN.source, minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(CODE_PATTERN)
  code!: string;
}
export class RegistrationPendingDto {
  @ApiProperty({ format: "uuid" }) registrationId!: string;
  @ApiProperty({ format: "date-time" }) expiresAt!: string;
}
