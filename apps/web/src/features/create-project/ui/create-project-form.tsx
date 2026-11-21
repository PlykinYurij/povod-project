"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { ApiRequestError } from "@shared/api";
import { Alert, Anchor, Button, Stack, Text, TextInput } from "@shared/ui";
import { useCreateDraft } from "../model/use-create-draft";
import styles from "./create-project.module.css";

function failureMessage(
  error: unknown,
): "quota" | "templateUnavailable" | "keyConflict" | "saveError" {
  if (!(error instanceof ApiRequestError)) return "saveError";
  if (error.code === "DRAFT_LIMIT_REACHED") return "quota";
  if (error.code === "IDEMPOTENCY_KEY_REUSED") return "keyConflict";
  if (
    error.code === "TEMPLATE_NOT_FOUND" ||
    error.code === "TEMPLATE_UNAVAILABLE"
  )
    return "templateUnavailable";
  return "saveError";
}

export function CreateProjectForm({
  templateVersionId,
  templateTitle,
  onUnauthorized,
}: {
  templateVersionId: string;
  templateTitle: string;
  onUnauthorized: () => void;
}) {
  const t = useTranslations("Projects");
  const action = useCreateDraft(templateVersionId, onUnauthorized);
  const { register, handleSubmit, formState } = useForm<{ title: string }>({
    defaultValues: { title: "" },
  });
  const apiError =
    action.error instanceof ApiRequestError ? action.error : undefined;
  const titleRejected = apiError?.fields.some(({ path }) => path === "title");
  const keyConflict = apiError?.code === "IDEMPOTENCY_KEY_REUSED";
  const submit = handleSubmit(({ title }) => action.submit(title.trim()));

  return (
    <form noValidate onSubmit={submit}>
      <Stack align="start">
        <Text>{t("selection", { title: templateTitle })}</Text>
        <Text>{t("creationHelp")}</Text>
        <TextInput
          label={t("name")}
          description={t("nameHelp")}
          classNames={{ description: styles.description }}
          error={
            formState.errors.title?.message ??
            (titleRejected ? t("invalidName") : undefined)
          }
          required
          readOnly={action.busy || action.uncertain}
          w="100%"
          {...register("title", {
            validate: (title) => {
              const value = title.trim();
              return (
                (value.length > 0 &&
                  [...value].length <= 24 &&
                  !/[\p{Cc}\p{Cs}]/u.test(value)) ||
                t("invalidName")
              );
            },
          })}
        />
        {action.error != null && !titleRejected && (
          <Alert role="alert" color="red">
            {t(
              action.uncertain && !keyConflict
                ? "verifySave"
                : failureMessage(action.error),
            )}
          </Alert>
        )}
        {action.uncertain && (
          <Anchor component={Link} href="/account">
            {t("openProjects")}
          </Anchor>
        )}
        <Button
          type="submit"
          autoContrast
          loading={action.busy}
          disabled={keyConflict || action.remaining > 0}
        >
          {t(action.uncertain ? "retry" : "create")}
        </Button>
      </Stack>
    </form>
  );
}
