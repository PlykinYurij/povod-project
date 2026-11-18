"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, PasswordInput, TextInput } from "../../shared/ui";
import { identityErrorKey } from "../../shared/api/identity-errors";

export function NewPasswordInput({
  disabled,
  error,
  name = "password",
}: {
  disabled: boolean;
  error?: boolean;
  name?: string;
}) {
  const t = useTranslations("Identity");
  const auth = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  return (
    <PasswordInput
      name={name}
      label={t("newPassword")}
      description={t("passwordRules")}
      autoComplete="new-password"
      minLength={8}
      maxLength={128}
      required
      disabled={disabled}
      visible={visible}
      onVisibilityChange={setVisible}
      visibilityToggleButtonProps={{
        "aria-label": auth(visible ? "hide" : "show"),
      }}
      error={error ? t("passwordRules") : undefined}
    />
  );
}

export function EmailCodeInput({
  disabled,
  error,
  rejected,
}: {
  disabled: boolean;
  error?: boolean;
  rejected?: boolean;
}) {
  const t = useTranslations("Identity");
  return (
    <TextInput
      label={t("code")}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      minLength={6}
      maxLength={6}
      required
      disabled={disabled}
      error={error ? t("codeFormat") : rejected ? t("codeRejected") : undefined}
    />
  );
}

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
