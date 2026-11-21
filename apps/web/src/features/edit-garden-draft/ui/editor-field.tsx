"use client";

import { useTranslations } from "next-intl";
import { useFormContext, type FieldPathByValue } from "react-hook-form";
import { Textarea, TextInput } from "@shared/ui";
import type { GardenEditorValues } from "../model/editor-values";

export type TextPath = FieldPathByValue<GardenEditorValues, string | null>;

export function EditorField({
  name,
  label,
  max,
  multiline,
  inputType,
  serverError,
}: {
  name: TextPath;
  label: string;
  max?: number;
  multiline?: boolean;
  inputType?: "date" | "time" | "url";
  serverError: boolean;
}) {
  const t = useTranslations("DraftEditor");
  const { register, getFieldState, formState } =
    useFormContext<GardenEditorValues>();
  const props = {
    ...register(name, {
      validate: (value) =>
        max === undefined ||
        value === null ||
        [...value].length <= max ||
        t("tooLong", { max }),
    }),
    label,
    error:
      getFieldState(name, formState).error?.message ??
      (serverError ? t("invalid") : undefined),
  };
  return multiline ? (
    <Textarea {...props} rows={3} resize="vertical" />
  ) : (
    <TextInput {...props} type={inputType} />
  );
}
