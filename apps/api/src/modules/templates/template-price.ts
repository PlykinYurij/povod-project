import { ApiError } from "../../http/api-error";
import type { TemplatePriceDto } from "./template-catalog.dto";

export function templatePrice(row: {
  priceMinor: number | null;
  currency: string;
  priceVersion: number;
}): TemplatePriceDto | null {
  if (row.currency !== "RUB")
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Стоимость шаблона недоступна",
    );
  return row.priceMinor === null
    ? null
    : {
        amountMinor: row.priceMinor,
        currency: "RUB",
        version: row.priceVersion,
      };
}
