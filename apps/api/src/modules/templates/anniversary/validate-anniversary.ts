import { plainToInstance, type ClassConstructor } from "class-transformer";
import { validateSync } from "class-validator";
import { ApiError, type FieldErrorDto } from "../../../http/api-error";
import {
  reservedFieldErrors,
  validationFields,
} from "../../../http/validation-errors";
import { AnniversaryContentDto, AnniversaryDraftDto } from "./anniversary-content.dto";

export function validateAnniversaryDraft(input: unknown): AnniversaryDraftDto {
  return validateAnniversaryDto(AnniversaryDraftDto, input);
}

export function validateAnniversaryContent(input: unknown): AnniversaryContentDto {
  return validateAnniversaryDto(AnniversaryContentDto, input);
}

/** Content readiness is independent of authorization, media readiness, and publication expiry. */
export function validateAnniversaryComplete(input: unknown): AnniversaryDraftDto {
  const draft = validateAnniversaryDraft(input);
  const { celebrant, event, venue, copy } = draft.content;
  const required = {
    title: draft.title,
    "content.celebrant": celebrant,
    "content.event.date": event.date,
    "content.event.startTime": event.startTime,
    "content.event.timeZone": event.timeZone,
    "content.venue.name": venue.name,
    "content.venue.address": venue.address,
    "content.copy.rsvpAction": copy.rsvpAction,
  };
  const fields = Object.entries(required).flatMap(([path, value]) =>
    value.trim() ? [] : [{ path, code: "REQUIRED" }],
  );
  if (fields.length) throw invalid(fields);
  return draft;
}

function validateAnniversaryDto<T extends object>(
  type: ClassConstructor<T>,
  input: unknown,
): T {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw invalid([{ path: "content", code: "INVALID_VALUE" }]);
  }
  const reserved = reservedFieldErrors(input);
  if (reserved.length) throw invalid(reserved);
  const dto = plainToInstance(type, input, { enableImplicitConversion: false });
  const fields = validationFields(
    validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
  if (fields.length) throw invalid(fields);
  return dto;
}

function invalid(fields: FieldErrorDto[]): ApiError {
  return new ApiError(422, "VALIDATION_FAILED", "Проверьте поля", fields);
}
