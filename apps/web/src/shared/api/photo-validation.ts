import { isProjectId } from "@shared/config/project-navigation";
import { isRequestTimestamp } from "./service-request-validation";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validPhoto(value: unknown): boolean {
  return (
    record(value) &&
    Object.keys(value).length === 6 &&
    typeof value.id === "string" &&
    isProjectId(value.id) &&
    typeof value.status === "string" &&
    ["UPLOADING", "PROCESSING", "READY", "FAILED"].includes(value.status) &&
    positive(value.width) &&
    positive(value.height) &&
    value.width * value.height <= 40_000_000 &&
    positive(value.byteSize) &&
    value.byteSize <= 15 * 1024 * 1024 &&
    isRequestTimestamp(value.createdAt)
  );
}

export function validPhotoResponse(value: unknown, list: boolean): boolean {
  return list
    ? record(value) &&
        Object.keys(value).length === 1 &&
        Array.isArray(value.items) &&
        value.items.length <= 10 &&
        value.items.every(validPhoto)
    : validPhoto(value);
}
