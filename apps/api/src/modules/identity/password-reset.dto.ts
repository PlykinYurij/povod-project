import { ApiProperty, PickType } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";
import { RegisterDto } from "./register.dto";
import { StrongPassword } from "./password-validation";

const RESET_CODE_PATTERN = /^[0-9]{6}(?![\s\S])/;

export class RequestPasswordResetDto extends PickType(RegisterDto, ["email"] as const) {}

export class ConfirmPasswordResetDto extends PickType(RegisterDto, ["email"] as const) {
  @ApiProperty({ writeOnly: true, pattern: RESET_CODE_PATTERN.source, minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(RESET_CODE_PATTERN)
  code!: string;

  @StrongPassword()
  newPassword!: string;
}

export class PasswordResetAcceptedDto {
  @ApiProperty({ example: "Если аккаунт существует, письмо с кодом будет доступно в почте" })
  message!: string;
}
