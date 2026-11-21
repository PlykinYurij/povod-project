"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import {
  ApiRequestError,
  publishAdminRequest,
  type PublishRequestDto,
  type PublicationReceiptDto,
} from "@shared/api";
import { PUBLICATION_SLUG } from "@shared/config/publication-host";
import { useFormAction } from "@shared/lib/use-form-action";
import {
  Alert,
  Button,
  Checkbox,
  Stack,
  Text,
  TextInput,
  Title,
} from "@shared/ui";

type Approval = Omit<PublishRequestDto, "slug">;
type Fields = { slug: string; confirmed: boolean };

const refreshErrors = new Set([
  "REVISION_CONFLICT",
  "REQUEST_STATE_CONFLICT",
  "PRICE_CHANGED",
  "ALREADY_PUBLISHED",
]);
function failureMessage(code?: string) {
  switch (code) {
    case "PUBLICATION_LIMIT_REACHED":
      return "quota";
    case "PRICE_NOT_CONFIGURED":
      return "pricePending";
    case "VALIDATION_FAILED":
      return "invalidContent";
    default:
      return "failed";
  }
}

export function PublishRequestForm({
  requestId,
  approval,
  onPublished,
  refresh,
}: {
  requestId: string;
  approval: Approval;
  onPublished: (receipt: PublicationReceiptDto) => void;
  refresh: () => Promise<unknown>;
}) {
  const t = useTranslations("AdminPublish");
  const form = useForm<Fields>({
    defaultValues: { slug: "", confirmed: false },
  });
  const action = useFormAction();
  const attempt = useRef<{ payload: string; requestKey: string }>(null);
  const [submitted, setSubmitted] = useState<{
    approval: string;
    slug: string;
  }>();
  const currentSlug = useWatch({ control: form.control, name: "slug" });
  const { resetField } = form;
  const approvalKey = JSON.stringify(approval);
  useEffect(() => resetField("confirmed"), [approvalKey, resetField]);
  const error =
    action.error instanceof ApiRequestError ? action.error : undefined;
  const requiresRefresh = !!error && refreshErrors.has(error.code);
  const blocked = requiresRefresh && submitted?.approval === approvalKey;
  const slugError =
    error?.code === "SLUG_TAKEN" ||
    error?.fields.some(({ path }) => path === "slug");
  const formError =
    action.error && !slugError
      ? requiresRefresh
        ? "stale"
        : failureMessage(error?.code)
      : undefined;

  const submit = form.handleSubmit(({ slug }) =>
    action.run(async () => {
      const body = { ...approval, slug };
      const payload = JSON.stringify(body);
      const requestKey =
        attempt.current?.payload === payload
          ? attempt.current.requestKey
          : crypto.randomUUID();
      attempt.current = { payload, requestKey };
      setSubmitted({ approval: approvalKey, slug });
      return publishAdminRequest(requestId, body, {
        headers: { "Idempotency-Key": requestKey },
        signal: AbortSignal.timeout(15_000),
      });
    }, onPublished),
  );

  return (
    <form noValidate onSubmit={submit}>
      <Stack>
        <Title order={3}>{t("title")}</Title>
        <Text>{t("description")}</Text>
        <TextInput
          label={t("slug")}
          description={t("slugHint")}
          autoCapitalize="off"
          spellCheck={false}
          maxLength={63}
          readOnly={action.busy}
          error={
            form.formState.errors.slug?.message ??
            (slugError && submitted?.slug === currentSlug
              ? t(error?.code === "SLUG_TAKEN" ? "slugTaken" : "slugInvalid")
              : undefined)
          }
          {...form.register("slug", {
            validate: (value) =>
              PUBLICATION_SLUG.test(value) || t("slugInvalid"),
            onChange: () => form.clearErrors("slug"),
          })}
        />
        <Checkbox
          label={t("confirm")}
          disabled={action.busy}
          error={form.formState.errors.confirmed?.message}
          {...form.register("confirmed", { required: t("confirmRequired") })}
        />
        {formError && (
          <Alert color="red" role="alert">
            <Stack align="start">
              <Text>{t(formError)}</Text>
              {requiresRefresh && (
                <Button variant="default" onClick={() => void refresh()}>
                  {t("refresh")}
                </Button>
              )}
            </Stack>
          </Alert>
        )}
        <Button
          type="submit"
          loading={action.busy}
          disabled={blocked}
          w="fit-content"
        >
          {t("submit")}
        </Button>
      </Stack>
    </form>
  );
}
