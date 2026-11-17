import { HttpException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FieldErrorDto {
  @ApiProperty() path!: string;
  @ApiProperty() code!: string;
}
class ErrorDetailsDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
  @ApiPropertyOptional({ type: [FieldErrorDto] }) fields?: FieldErrorDto[];
}
export class ApiErrorDto {
  @ApiProperty({ type: ErrorDetailsDto }) error!: ErrorDetailsDto;
}
export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    fields?: FieldErrorDto[],
  ) {
    super({ code, message, ...(fields ? { fields } : {}) }, status);
  }
}
