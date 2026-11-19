"use client";
import { useTranslations } from "next-intl";
import { Alert } from "@shared/ui";
import {
  identityErrorKey,
  hasInlineFieldErrors,
} from "@shared/api/identity-errors";
export function IdentityError({
  error,
  remaining,
  confirming = false,
}: {
  error: unknown;
  remaining: number;
  confirming?: boolean;
}) {
  const t = useTranslations("Identity");
  if (!error) return null;
  const key = identityErrorKey(error, confirming);
  // Field failures use the same inline presentation as client validation.
  if (
    ["invalidCode", "emailUnavailable"].includes(key) ||
    hasInlineFieldErrors(error, [
      "email",
      "password",
      "newPassword",
      "userName",
      "code",
    ])
  )
    return null;
  return (
    <Alert color="red" role="alert">
      {key === "rate"
        ? remaining > 0
          ? t("rate", { seconds: remaining })
          : t("rateUnknown")
        : t(key)}
    </Alert>
  );
}
