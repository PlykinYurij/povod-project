"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, PasswordInput, TextInput } from "../../shared/ui";
import {
  identityErrorKey,
  hasInlineFieldErrors,
} from "../../shared/api/identity-errors";
import {
  passwordRules,
  passwordsMatch,
  validNewPassword,
} from "../../shared/lib/identity-validation";
import styles from "./password-fields.module.css";

export function NewPasswordFields({
  disabled,
  error,
  name = "password",
  submitted = false,
}: {
  disabled: boolean;
  error?: boolean;
  name?: string;
  submitted?: boolean;
}) {
  const t = useTranslations("Identity");
  const auth = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [value, setValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  return (
    <>
      <PasswordInput
        name={name}
        label={t("newPassword")}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        inputWrapperOrder={["label", "input", "description", "error"]}
        description={
          <span
            role="list"
            aria-label={t("passwordRequirements")}
            className={styles.rules}
          >
            {Object.entries(passwordRules(value)).map(([rule, passed]) => (
              <span
                key={rule}
                role="listitem"
                className={passed ? styles.passed : styles.missing}
                aria-label={`${t(`rule_${rule}`)}: ${t(passed ? "ruleMet" : "ruleMissing")}`}
              >
                <span aria-hidden="true" className={styles.marker}>
                  {passed ? "✓" : "○"}
                </span>
                {t(`rule_${rule}`)}
              </span>
            ))}
          </span>
        }
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
        error={
          error && !validNewPassword(value) ? t("passwordInvalid") : undefined
        }
      />
      <PasswordInput
        name="passwordConfirmation"
        label={t("confirmPassword")}
        autoComplete="new-password"
        required
        maxLength={128}
        disabled={disabled}
        value={confirmation}
        onChange={(event) => setConfirmation(event.currentTarget.value)}
        onBlur={() => setConfirmationTouched(true)}
        visible={confirmationVisible}
        onVisibilityChange={setConfirmationVisible}
        visibilityToggleButtonProps={{
          "aria-label": auth(confirmationVisible ? "hide" : "show"),
        }}
        error={
          (submitted || confirmationTouched || confirmation.length > 0) &&
          !passwordsMatch(value, confirmation)
            ? t("passwordMismatch")
            : undefined
        }
      />
    </>
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
  // Field failures use the same inline presentation as client validation.
  if (
    ["invalidCode", "emailUnavailable"].includes(key) ||
    hasInlineFieldErrors(error, [
      "email",
      "password",
      "newPassword",
      "displayName",
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
