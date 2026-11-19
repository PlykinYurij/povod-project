"use client";
import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { TextInput, type TextInputProps } from "@shared/ui";

export function EmailCodeInput(
  props: TextInputProps & { ref?: Ref<HTMLInputElement> },
) {
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
      {...props}
    />
  );
}
