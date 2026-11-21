import type { ServiceRequest } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import type { TemplatePriceDto } from "../templates/template-catalog.dto";

type PriceFields = Pick<
  ServiceRequest,
  "priceSnapshotMinor" | "priceSnapshotCurrency" | "priceSnapshotVersion"
>;

export function requestPriceData(price: TemplatePriceDto | null): PriceFields {
  return {
    priceSnapshotMinor: price?.amountMinor ?? null,
    priceSnapshotCurrency: price?.currency ?? null,
    priceSnapshotVersion: price?.version ?? null,
  };
}

export function readRequestPrice(row: PriceFields): TemplatePriceDto | null {
  if (
    row.priceSnapshotMinor === null &&
    row.priceSnapshotCurrency === null &&
    row.priceSnapshotVersion === null
  )
    return null;
  if (
    row.priceSnapshotMinor === null ||
    row.priceSnapshotCurrency !== "RUB" ||
    row.priceSnapshotVersion === null
  )
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Стоимость заявки недоступна",
    );
  return {
    amountMinor: row.priceSnapshotMinor,
    currency: "RUB",
    version: row.priceSnapshotVersion,
  };
}
