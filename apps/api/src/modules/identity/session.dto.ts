import { ApiProperty, PickType } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";
import { RegisterDto } from "./register.dto";

export class LoginDto extends PickType(RegisterDto, ["email"] as const) {
  @ApiProperty({
    format: "password",
    writeOnly: true,
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}
export class CsrfResponseDto {
  @ApiProperty() csrfToken!: string;
  @ApiProperty({ format: "date-time" }) expiresAt!: string;
}
