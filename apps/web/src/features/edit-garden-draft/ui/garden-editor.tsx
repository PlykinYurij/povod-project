"use client";

import { useTranslations } from "next-intl";
import { FormProvider, useWatch, type FieldValues } from "react-hook-form";
import type { ReactNode } from "react";
import type { ProjectDto } from "@shared/api";
import type { PhotoSource } from "@entities/project-photo";
import { Alert, Anchor, Button, Stack, Text } from "@shared/ui";
import { ACCOUNT_ROUTE } from "@shared/config/auth-navigation";
import {
  useDraftEditor,
  useVersionedDraftEditor,
  type DraftEditorAccess,
} from "../model/use-draft-editor";
import { EditorContent } from "./editor-content";
import { DraftPhotoField } from "./draft-photo-field";
import styles from "./garden-editor.module.css";

export function GardenEditor({
  project,
  access,
  photoSource,
}: {
  project: ProjectDto;
  access?: DraftEditorAccess;
  photoSource?: PhotoSource;
}) {
  const editor = useDraftEditor(project, access);
  const selected = useWatch({
    control: editor.form.control,
    name: "content.heroMediaId",
  });
  const rejected = new Set(editor.error?.fields.map(({ path }) => path));
  return (
    <DraftEditorForm editor={editor}>
      <EditorContent rejected={rejected} />
      {photoSource && (
        <DraftPhotoField
          key={photoSource.id}
          source={photoSource}
          selected={selected}
          select={(id) =>
            editor.form.setValue("content.heroMediaId", id, {
              shouldDirty: true,
            })
          }
          rejected={rejected.has("content.heroMediaId")}
        />
      )}
    </DraftEditorForm>
  );
}

export function DraftEditorForm<Values extends FieldValues>({
  editor,
  children,
}: {
  editor: ReturnType<typeof useVersionedDraftEditor<Values>>;
  children: ReactNode;
}) {
  const t = useTranslations("DraftEditor");
  const rejected = new Set(editor.error?.fields.map(({ path }) => path));
  const conflict = editor.status === "conflict";
  const locked = editor.status === "locked";
  const expired = editor.error?.status === 401;
  const dirty = editor.form.formState.isDirty;

  return (
    <FormProvider {...editor.form}>
      <form onSubmit={editor.submit} noValidate>
        <Stack>
          <fieldset className={styles.fields} disabled={editor.busy || locked}>
            <legend className={styles.legend}>{t("fieldsLegend")}</legend>
            {children}
          </fieldset>
          <Stack align="start">
            {locked && (
              <Alert role="alert" color="red">
                {t("locked")}
              </Alert>
            )}
            {conflict && (
              <Alert role="alert" color="yellow">
                <Stack align="start">
                  <Text>{t("conflict")}</Text>
                  <Button
                    type="button"
                    variant="default"
                    loading={editor.busy}
                    onClick={() => void editor.loadServerVersion()}
                  >
                    {t("discardAndLoad")}
                  </Button>
                </Stack>
              </Alert>
            )}
            {editor.failed &&
              !locked &&
              (!conflict || editor.error?.code !== "REVISION_CONFLICT") && (
                <Alert role="alert" color="red">
                  <Text>
                    {t(
                      expired
                        ? "expired"
                        : rejected.size > 0
                          ? "invalidFields"
                          : "saveFailed",
                    )}
                  </Text>
                  {expired && (
                    <Anchor
                      href={ACCOUNT_ROUTE}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("restoreSession")}
                    </Anchor>
                  )}
                </Alert>
              )}
            {editor.status === "saved" && !dirty && (
              <Text role="status">{t("saved")}</Text>
            )}
            {editor.status === "loaded" && !dirty && (
              <Text role="status">{t("loaded")}</Text>
            )}
            <Button
              type="submit"
              loading={editor.busy && !conflict}
              autoContrast
              disabled={!dirty || conflict || locked || editor.busy}
            >
              {t("save")}
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}
