import type { Response } from "express";
import { ApiError } from "../../http/api-error";
import type { ServiceRequestReceiptDto } from "./service-request.dto";

type AcceptedSubmission = {
  kind: "accepted";
  receipt: ServiceRequestReceiptDto;
  replay: boolean;
};
type LimitedSubmission = { kind: "rate-limited"; retryAfterSeconds: number };
export type RequestSubmissionResult = AcceptedSubmission | LimitedSubmission;

export function acceptedRequest(
  row: { id: string; createdAt: Date },
  replay: boolean,
): AcceptedSubmission {
  return {
    kind: "accepted",
    replay,
    receipt: {
      requestId: row.id,
      status: "RECEIVED",
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export function limitedRequest(until: Date, now: Date): LimitedSubmission {
  return {
    kind: "rate-limited",
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((until.getTime() - now.getTime()) / 1000),
    ),
  };
}

/** Called only after the transaction commits, so a denial cannot roll back rate counters. */
export function submissionResponse(
  result: RequestSubmissionResult,
  response: Response,
): ServiceRequestReceiptDto {
  if (result.kind === "rate-limited") {
    response.setHeader("Retry-After", result.retryAfterSeconds);
    throw new ApiError(429, "RATE_LIMITED", "Повторите запрос позже");
  }
  response.status(result.replay ? 200 : 201);
  return result.receipt;
}
