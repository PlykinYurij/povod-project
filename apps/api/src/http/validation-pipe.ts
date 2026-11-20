import { ValidationPipe, type ArgumentMetadata } from "@nestjs/common";
import { ApiError } from "./api-error";
import { reservedFieldErrors, validationFields } from "./validation-errors";

class StrictValidationPipe extends ValidationPipe {
  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    const fields = reservedFieldErrors(value);
    if (fields.length)
      throw new ApiError(422, "VALIDATION_FAILED", "Проверьте поля", fields);
    return super.transform(value, metadata);
  }
}

export function createValidationPipe(): ValidationPipe {
  return new StrictValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new ApiError(
        422,
        "VALIDATION_FAILED",
        "Проверьте поля",
        validationFields(errors),
      ),
  });
}
