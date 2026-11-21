import type { ProjectPublicationRequestDto } from "./generated/models";
import { isTemplatePrice } from "./catalog-validation";
import { isRequestTimestamp } from "./service-request-validation";
import { isProjectId } from "@shared/config/project-navigation";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isProjectPublicationRequest(
  value: unknown,
): value is ProjectPublicationRequestDto {
  if (
    !object(value) ||
    Object.keys(value).length !== 3 ||
    !("request" in value) ||
    !isTemplatePrice(value.currentPrice)
  )
    return false;
  const closed = value.lastClosed;
  if (
    closed !== null &&
    (!object(closed) ||
      Object.keys(closed).length !== 3 ||
      typeof closed.requestId !== "string" ||
      !isProjectId(closed.requestId) ||
      typeof closed.status !== "string" ||
      !["REJECTED", "CANCELLED", "COMPLETED"].includes(closed.status) ||
      !isRequestTimestamp(closed.updatedAt))
  )
    return false;
  if (value.request === null) return true;
  const request = value.request;
  if (!object(request) || Object.keys(request).length !== 8) return false;
  return (
    typeof request.requestId === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      request.requestId,
    ) &&
    typeof request.kind === "string" &&
    ["ASSISTANCE", "PUBLICATION"].includes(request.kind) &&
    typeof request.status === "string" &&
    ["NEW", "IN_PROGRESS"].includes(request.status) &&
    positiveInt(request.requestVersion) &&
    ((request.kind === "ASSISTANCE" && request.submittedRevision === null) ||
      positiveInt(request.submittedRevision)) &&
    positiveInt(request.currentProjectRevision) &&
    isTemplatePrice(request.price) &&
    isRequestTimestamp(request.createdAt)
  );
}
