import type { RsvpFormSchema } from "../../database/generated/client";

export const RSVP_NAME_MAX_LENGTH = 80;
export const RSVP_MAX_COMPANIONS = 2;
export const RSVP_ATTENDANCE = ["yes", "no"] as const;

export function publicFormSchema(schema: RsvpFormSchema): "garden-v1" {
  switch (schema) {
    case "garden_v1":
      return "garden-v1";
  }
}
