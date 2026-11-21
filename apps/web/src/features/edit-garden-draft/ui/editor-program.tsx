"use client";

import { useTranslations } from "next-intl";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button, Checkbox, Group, Stack } from "@shared/ui";
import type { GardenEditorValues } from "../model/editor-values";
import { EditorField } from "./editor-field";

export function EditorProgram({ rejected }: { rejected: ReadonlySet<string> }) {
  const t = useTranslations("DraftEditor");
  const { control, register } = useFormContext<GardenEditorValues>();
  const enabled = useWatch({ control, name: "programEnabled" });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "content.program",
  });
  return (
    <Stack>
      <Checkbox label={t("showProgram")} {...register("programEnabled")} />
      {enabled && (
        <>
          {fields.map((field, index) => {
            const time = `content.program.${index}.time` as const;
            const text = `content.program.${index}.text` as const;
            return (
              <Group key={field.id} align="end">
                <EditorField
                  name={time}
                  label={t("itemTime", { index: index + 1 })}
                  max={5}
                  inputType="time"
                  serverError={rejected.has(time)}
                />
                <EditorField
                  name={text}
                  label={t("itemText", { index: index + 1 })}
                  max={200}
                  serverError={rejected.has(text)}
                />
                <Button
                  type="button"
                  variant="subtle"
                  onClick={() => remove(index)}
                  aria-label={t("removeItem", { index: index + 1 })}
                >
                  {t("remove")}
                </Button>
              </Group>
            );
          })}
          <Button
            type="button"
            variant="light"
            w="fit-content"
            disabled={fields.length >= 12}
            onClick={() => append({ time: "", text: "" })}
          >
            {t("addItem")}
          </Button>
        </>
      )}
    </Stack>
  );
}
