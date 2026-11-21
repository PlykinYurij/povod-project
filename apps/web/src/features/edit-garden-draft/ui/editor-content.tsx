"use client";

import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { NativeSelect, Stack, Text, Title } from "@shared/ui";
import { copyLimits, type GardenEditorValues } from "../model/editor-values";
import { EditorField, type TextPath } from "./editor-field";
import { EditorProgram } from "./editor-program";

const eventFields = [
  { name: "content.names.first", label: "firstName", max: 20 },
  { name: "content.names.second", label: "secondName", max: 20 },
  {
    name: "content.event.localDate",
    label: "date",
    max: 10,
    inputType: "date",
  },
  { name: "content.event.localTime", label: "time", max: 5, inputType: "time" },
  { name: "content.event.timeZone", label: "zone" },
  { name: "content.venue.name", label: "venue", max: 80 },
  { name: "content.venue.address", label: "address", max: 150 },
  {
    name: "content.venue.routeUrl",
    label: "route",
    max: 200,
    inputType: "url",
  },
] as const satisfies readonly {
  name: TextPath;
  label: string;
  max?: number;
  inputType?: "date" | "time" | "url";
}[];

export function EditorContent({ rejected }: { rejected: ReadonlySet<string> }) {
  const t = useTranslations("DraftEditor");
  const { register } = useFormContext<GardenEditorValues>();
  return (
    <Stack gap="xl">
      <Stack component="section">
        <Title order={2}>{t("setup")}</Title>
        <EditorField
          name="title"
          label={t("title")}
          max={24}
          serverError={rejected.has("title")}
        />
        <NativeSelect
          label={t("style")}
          error={rejected.has("content.themeId") ? t("invalid") : undefined}
          data={[
            { value: "sage", label: t("sage") },
            { value: "sand", label: t("sand") },
          ]}
          {...register("content.themeId")}
        />
        <NativeSelect
          label={t("language")}
          error={rejected.has("content.locale") ? t("invalid") : undefined}
          data={[
            { value: "ru", label: t("russian") },
            { value: "en", label: t("english") },
          ]}
          {...register("content.locale")}
        />
        <Text size="sm">{t("languageHelp")}</Text>
      </Stack>
      <Stack component="section">
        <Title order={2}>{t("event")}</Title>
        {eventFields.map(({ name, label, ...options }) => (
          <EditorField
            key={name}
            name={name}
            label={t(label)}
            serverError={rejected.has(name)}
            {...options}
          />
        ))}
      </Stack>
      <Stack component="section">
        <Title order={2}>{t("program")}</Title>
        <EditorProgram rejected={rejected} />
      </Stack>
      <Stack component="section">
        <Title order={2}>{t("copyTitle")}</Title>
        {(Object.keys(copyLimits) as (keyof typeof copyLimits)[]).map((key) => {
          const name = `content.copy.${key}` as const;
          return (
            <EditorField
              key={key}
              name={name}
              label={t(`copy.${key}`)}
              max={copyLimits[key]}
              multiline={key === "introduction" || key === "footerText"}
              serverError={rejected.has(name)}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
