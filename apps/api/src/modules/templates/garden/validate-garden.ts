import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ApiError, type FieldErrorDto } from "../../../http/api-error";
import {
  reservedFieldErrors,
  validationFields,
} from "../../../http/validation-errors";
import { GardenDraftDto } from "./garden-content.dto";

/** Runtime boundary for persisted JSON/future draft writes; no coercion or normalization. */
export function validateGardenDraft(input: unknown): GardenDraftDto {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw invalid([{ path: "content", code: "INVALID_VALUE" }]);
  }
  const reserved = reservedFieldErrors(input);
  if (reserved.length) throw invalid(reserved);
  const draft = plainToInstance(GardenDraftDto, input, {
    enableImplicitConversion: false,
  });
  const fields = validationFields(
    validateSync(draft, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
  if (fields.length) throw invalid(fields);
  return draft;
}

/** Content completeness only; this does not authorize publication or validate an RSVP form. */
export function validateGardenComplete(input: unknown): GardenDraftDto {
  const draft = validateGardenDraft(input);
  const { names, event, venue, program } = draft.content;
  const required: [string, string][] = [
    ["title", draft.title],
    ["content.names.first", names.first],
    ["content.names.second", names.second],
    ["content.event.localDate", event.localDate],
    ["content.event.localTime", event.localTime],
    ["content.event.timeZone", event.timeZone],
    ["content.venue.name", venue.name],
    ["content.venue.address", venue.address],
  ];
  const fields: FieldErrorDto[] = [];
  if (program !== null) {
    if (!program.length)
      fields.push({ path: "content.program", code: "REQUIRED" });
    program.forEach((item, index) => {
      required.push(
        [`content.program.${index}.time`, item.time],
        [`content.program.${index}.text`, item.text],
      );
    });
  }
  for (const [path, value] of required) {
    if (!value.trim()) fields.push({ path, code: "REQUIRED" });
  }
  if (fields.length) throw invalid(fields);
  return draft;
}

function invalid(fields: FieldErrorDto[]): ApiError {
  return new ApiError(422, "VALIDATION_FAILED", "Проверьте поля", fields);
}
