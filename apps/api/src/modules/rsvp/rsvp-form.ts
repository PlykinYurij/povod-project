import type { RsvpFormSchema } from "../../database/generated/client";
import type { PublicRsvpFormDto } from "./rsvp.dto";

export const RSVP_NAME_MAX_LENGTH = 80;
export const RSVP_MAX_COMPANIONS = 2;
export const RSVP_ATTENDANCE = ["yes", "no"] as const;

export function describeRsvpForm(
  formVersionId: string,
  schema: RsvpFormSchema,
): PublicRsvpFormDto {
  switch (schema) {
    case "garden_v1":
      return {
        formVersionId,
        schema: "garden-v1",
        nameMaxLength: RSVP_NAME_MAX_LENGTH,
        maxCompanions: RSVP_MAX_COMPANIONS,
      };
  }
}
