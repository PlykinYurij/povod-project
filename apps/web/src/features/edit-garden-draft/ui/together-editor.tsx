"use client";

import { useTranslations } from "next-intl";
import { useWatch, type FieldPathByValue } from "react-hook-form";
import type { PhotoSource } from "@entities/project-photo";
import type { ProjectDto, TogetherContentDto } from "@shared/api";
import { Checkbox, NativeSelect, Textarea, TextInput } from "@shared/ui";
import {
  useVersionedDraftEditor,
  type DraftEditorAccess,
} from "../model/use-draft-editor";
import { DraftPhotoField } from "./draft-photo-field";
import { DraftEditorForm } from "./garden-editor";

type Values = { title: string; content: TogetherContentDto };
type TextPath = FieldPathByValue<Values, string>;
const fields = [
  ["title", "title", 24],
  ["content.names.first", "first", 20],
  ["content.names.second", "second", 20],
  ["content.event.date", "date", 10, "date"],
  ["content.event.startTime", "time", 5, "time"],
  ["content.event.timeZone", "timeZone", 64],
  ["content.venue.name", "venue", 80],
  ["content.venue.address", "address", 150],
  ["content.photo.alt", "photoAlt", 200],
  ["content.note.heading", "noteHeading", 160],
  ["content.note.body", "noteBody", 1000, "textarea"],
  ["content.copy.heroLabel", "heroLabel", 80],
  ["content.copy.separator", "separator", 16],
  ["content.copy.intro", "intro", 4000, "textarea"],
  ["content.copy.eventHeading", "eventHeading", 160],
  ["content.copy.dateLabel", "dateLabel", 80],
  ["content.copy.venueLabel", "venueLabel", 80],
  ["content.copy.photoHeading", "photoHeading", 160],
  ["content.copy.rsvpHeading", "rsvpHeading", 160],
  ["content.copy.rsvpIntro", "rsvpIntro", 4000, "textarea"],
  ["content.copy.rsvpAction", "rsvpAction", 80],
  ["content.copy.signoff", "signoff", 1000, "textarea"],
] as const satisfies readonly (readonly [
  TextPath,
  string,
  number,
  ("date" | "time" | "textarea")?,
])[];

function read(project: ProjectDto): Values {
  if (
    project.templateVersionId !== "wedding-together-v1" ||
    !("photo" in project.content && "names" in project.content)
  )
    throw new Error("Unexpected invitation schema for the Together editor");
  return { title: project.title, content: project.content };
}

export function TogetherEditor({
  project,
  access,
  photoSource,
}: {
  project: ProjectDto;
  access?: DraftEditorAccess;
  photoSource?: PhotoSource;
}) {
  const t = useTranslations("DraftEditor");
  const labels = useTranslations("DraftEditor.together");
  const editor = useVersionedDraftEditor<Values>(
    project,
    {
      read,
      write: (values, expectedRevision) => ({ ...values, expectedRevision }),
    },
    access,
  );
  const { register, control, getFieldState, formState, setValue } = editor.form;
  const selected = useWatch({ control, name: "content.photo.mediaId" });
  const rejected = new Set(editor.error?.fields.map(({ path }) => path));
  return (
    <DraftEditorForm editor={editor}>
      <NativeSelect
        label={labels("locale")}
        data={[
          { value: "ru", label: "Русский" },
          { value: "en", label: "English" },
        ]}
        error={rejected.has("content.locale") ? t("invalid") : undefined}
        {...register("content.locale")}
      />
      <Checkbox
        label={labels("noteEnabled")}
        {...register("content.note.enabled")}
      />
      {fields.map(([name, label, max, kind]) => {
        const props = {
          ...register(name, {
            validate: (value) =>
              [...value].length <= max || t("tooLong", { max }),
          }),
          label: labels(label),
          error:
            getFieldState(name, formState).error?.message ??
            (rejected.has(name) ? t("invalid") : undefined),
        };
        return kind === "textarea" ? (
          <Textarea key={name} {...props} rows={3} resize="vertical" />
        ) : (
          <TextInput key={name} {...props} type={kind} />
        );
      })}
      {photoSource && (
        <DraftPhotoField
          source={photoSource}
          selected={selected}
          select={(id) =>
            setValue("content.photo.mediaId", id, { shouldDirty: true })
          }
          rejected={rejected.has("content.photo.mediaId")}
        />
      )}
    </DraftEditorForm>
  );
}
