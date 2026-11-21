"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import type { ProjectDto } from "@shared/api";
import { Alert, Anchor, Button, Stack, Text } from "@shared/ui";
import { ACCOUNT_ROUTE } from "@shared/config/auth-navigation";
import {
  useDraftEditor,
  type DraftEditorAccess,
} from "../model/use-draft-editor";
import { EditorContent } from "./editor-content";
import styles from "./garden-editor.module.css";

export function GardenEditor({
  project,
  access,
}: {
  project: ProjectDto;
  access?: DraftEditorAccess;
}) {
  const t = useTranslations("DraftEditor");
  const editor = useDraftEditor(project, access);
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
            <EditorContent rejected={rejected} />
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
