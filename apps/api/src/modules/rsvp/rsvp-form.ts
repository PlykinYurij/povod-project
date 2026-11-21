import { ApiError } from "../../http/api-error";
import type { RsvpFormSchema } from "../../database/generated/client";

export const RSVP_NAME_MAX_LENGTH = 80;
export const RSVP_MAX_COMPANIONS = 2;
export const RSVP_ATTENDANCE = ["yes", "no"] as const;
export const RSVP_SLUG = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export function publicFormSchema(schema: RsvpFormSchema): "garden-v1" {
  switch (schema) {
    case "garden_v1":
      return "garden-v1";
  }
}

export function invitationUnavailable(): ApiError {
  return new ApiError(404, "INVITATION_UNAVAILABLE", "Приглашение недоступно");
}
