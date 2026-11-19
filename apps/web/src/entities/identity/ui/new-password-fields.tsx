"use client";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { PasswordInput } from "@shared/ui";
import {
  passwordsMatch,
  validNewPassword,
} from "@shared/lib/identity-validation";
import type { NewPasswordValues } from "../model/form-values";
import { PasswordChecklist } from "./password-checklist";

export function NewPasswordFields({
  disabled,
  serverError,
}: {
  disabled: boolean;
  serverError?: boolean;
}) {
  const t = useTranslations("Identity");
  const auth = useTranslations("Auth");
  const {
    register,
    control,
    getValues,
    trigger,
    formState: { errors, touchedFields, isSubmitted },
  } = useFormContext<NewPasswordValues>();
  const value = useWatch({ control, name: "password", defaultValue: "" });
  const confirmation = useWatch({
    control,
    name: "passwordConfirmation",
    defaultValue: "",
  });
  const [visible, setVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const checkConfirmation =
    isSubmitted ||
    !!touchedFields.passwordConfirmation ||
    confirmation.length > 0;
  useEffect(() => {
    if (checkConfirmation) void trigger("passwordConfirmation");
  }, [value, confirmation, checkConfirmation, trigger]);
  return (
    <>
      <PasswordInput
        {...register("password", {
          validate: (value) => validNewPassword(value) || t("passwordInvalid"),
        })}
        label={t("newPassword")}
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
        inputWrapperOrder={["label", "input", "description", "error"]}
        description={<PasswordChecklist value={value} />}
        error={
          errors.password?.message ??
          (serverError ? t("passwordInvalid") : undefined)
        }
      />
      <PasswordInput
        {...register("passwordConfirmation", {
          validate: (value) =>
            passwordsMatch(getValues("password"), value) ||
            t("passwordMismatch"),
        })}
        label={t("confirmPassword")}
        autoComplete="new-password"
        maxLength={128}
        required
        disabled={disabled}
        visible={confirmationVisible}
        onVisibilityChange={setConfirmationVisible}
        visibilityToggleButtonProps={{
          "aria-label": auth(confirmationVisible ? "hide" : "show"),
        }}
        error={errors.passwordConfirmation?.message}
      />
    </>
  );
}
