"use client";

import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import {
  ApiRequestError,
  createAssistedProject,
  useGetTemplateCatalog,
  type AdminRequestDetailDto,
} from "@shared/api";
import { parseLocale } from "@shared/config/locale";
import { useFormAction } from "@shared/lib/use-form-action";
import {
  Alert,
  Button,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title,
} from "@shared/ui";

type Values = { title: string; templateVersionId: string };

export function AssistedCreate({
  record,
  refresh,
}: {
  record: AdminRequestDetailDto;
  refresh: () => Promise<unknown>;
}) {
  const t = useTranslations("AdminRequests");
  const locale = parseLocale(useLocale());
  const catalog = useGetTemplateCatalog(
    { locale },
    { query: { retry: false } },
  );
  const form = useForm<Values>({
    defaultValues: { title: "", templateVersionId: "" },
  });
  const action = useFormAction();
  const error =
    action.error instanceof ApiRequestError ? action.error : undefined;
  const stale =
    error?.code === "REQUEST_STATE_CONFLICT" ||
    error?.code === "REQUEST_PROJECT_EXISTS";
  const templates = catalog.data?.items ?? [];
  const submit = form.handleSubmit(({ title, templateVersionId }) =>
    action.run(
      () =>
        createAssistedProject(
          record.id,
          {
            title: title.trim(),
            templateVersionId,
            expectedRequestVersion: record.requestVersion,
          },
          { signal: AbortSignal.timeout(15_000) },
        ),
      async () => {
        await refresh();
      },
    ),
  );
  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        <Title order={3}>{t("createDraft")}</Title>
        {catalog.isPending && <Text role="status">{t("catalogLoading")}</Text>}
        {catalog.isError && (
          <Alert role="alert">
            <Text>{t("catalogUnavailable")}</Text>
            <Button variant="default" onClick={() => void catalog.refetch()}>
              {t("refreshStatus")}
            </Button>
          </Alert>
        )}
        {catalog.isSuccess && templates.length === 0 && (
          <Text>{t("catalogEmpty")}</Text>
        )}
        {templates.length > 0 && (
          <>
            <NativeSelect
              label={t("template")}
              data={[
                { value: "", label: t("chooseTemplate") },
                ...templates.map((item) => ({
                  value: item.templateVersionId,
                  label: item.title,
                })),
              ]}
              disabled={action.busy}
              error={form.formState.errors.templateVersionId?.message}
              {...form.register("templateVersionId", {
                required: t("chooseTemplate"),
              })}
            />
            <TextInput
              label={t("draftTitle")}
              readOnly={action.busy}
              required
              error={form.formState.errors.title?.message}
              {...form.register("title", {
                validate: (input) => {
                  const title = input.trim();
                  return (
                    (title.length > 0 &&
                      [...title].length <= 24 &&
                      !/[\p{Cc}\p{Cs}]/u.test(title)) ||
                    t("titleInvalid")
                  );
                },
              })}
            />
            {action.error != null && (
              <Alert role="alert" color="red">
                <Text>
                  {t(
                    stale
                      ? "statusConflict"
                      : error?.code === "TEMPLATE_NOT_FOUND"
                        ? "catalogUnavailable"
                        : "createFailed",
                  )}
                </Text>
                {stale && (
                  <Button variant="default" onClick={() => void refresh()}>
                    {t("refreshStatus")}
                  </Button>
                )}
              </Alert>
            )}
            <Button
              type="submit"
              autoContrast
              loading={action.busy}
              w="fit-content"
            >
              {t("createDraft")}
            </Button>
          </>
        )}
      </Stack>
    </form>
  );
}
