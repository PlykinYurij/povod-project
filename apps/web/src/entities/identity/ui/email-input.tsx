"use client";
import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { TextInput, type TextInputProps } from "@shared/ui";

export function EmailInput(
  props: TextInputProps & { ref?: Ref<HTMLInputElement> },
) {
  const t = useTranslations("Auth");
  return (
    <TextInput
      label={t("email")}
      name="email"
      type="email"
      autoComplete="email"
      maxLength={254}
      required
      {...props}
    />
  );
}
