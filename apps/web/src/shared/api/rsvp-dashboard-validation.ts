import { isProjectId } from "@shared/config/project-navigation";
import type { RsvpDashboardDto } from "./generated/models";

function record(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isRsvpDashboard(input: unknown): input is RsvpDashboardDto {
  if (!record(input) || !record(input.counts) || !Array.isArray(input.items))
    return false;
  const { total, yes, no, companions } = input.counts;
  if (
    !count(total) ||
    !count(yes) ||
    !count(no) ||
    !count(companions) ||
    total !== yes + no ||
    input.items.length > total
  )
    return false;
  return input.items.every(
    (item: unknown) =>
      record(item) &&
      typeof item.id === "string" &&
      isProjectId(item.id) &&
      typeof item.name === "string" &&
      (item.attendance === "yes" || item.attendance === "no") &&
      count(item.companions) &&
      typeof item.receivedAt === "string" &&
      Number.isFinite(Date.parse(item.receivedAt)),
  );
}
