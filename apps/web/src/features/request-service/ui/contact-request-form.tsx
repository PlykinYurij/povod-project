"use client";

import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { ApiRequestError, type CreateServiceRequestDto } from "@shared/api";
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from "@shared/ui";
import { LOGIN_ROUTE } from "@shared/config/auth-navigation";
import {
  useContactRequest,
  type SendContactRequest,
} from "../model/use-contact-request";

type ContactValues = Omit<CreateServiceRequestDto, "privacyConsent"> & {
  privacyConsent: boolean;
};
const channels = [
  "TELEGRAM",
  "MAX",
  "VK",
] satisfies ContactValues["contactChannel"][];

function phoneValid(value: string) {
  const compact = value.trim().replace(/[\p{Zs}()-]/gu, "");
  return /^(?:\+[1-9]\d{6,14}|[78]\d{10})$/.test(compact);
}

function errorKey(error: unknown, uncertain: boolean) {
  if (error instanceof ApiRequestError) {
    if (error.code === "IDEMPOTENCY_KEY_REUSED") return "keyConflict";
    if (error.status === 401) return "expired";
    if (error.status === 429) return "rate";
    if (error.code === "PRICE_CHANGED" || error.code === "REVISION_CONFLICT")
      return "changed";
    if (error.code === "REQUEST_ALREADY_OPEN") return "alreadyOpen";
    if (error.code === "CONTENT_LOCKED") return "locked";
  }
  return uncertain ? "uncertain" : "failed";
}

export function ContactRequestForm({
  send,
  verify,
  busy = false,
}: {
  send: SendContactRequest;
  verify?: () => Promise<void>;
  busy?: boolean;
}) {
  const t = useTranslations("Requests");
  const action = useContactRequest(send);
  const form = useForm<ContactValues>({
    defaultValues: {
      contactName: "",
      phone: "",
      contactChannel: "TELEGRAM",
      contactValue: "",
      privacyConsent: false,
    },
  });
  const channel = useWatch({ control: form.control, name: "contactChannel" });
  const submit = form.handleSubmit((values) => {
    if (!values.privacyConsent) return;
    return action.submit({ ...values, privacyConsent: true });
  });
  if (action.receipt)
    return (
      <Alert role="status" color="green">
        <Text>{t("received")}</Text>
        <Text size="sm">
          {t("reference", { id: action.receipt.requestId })}
        </Text>
      </Alert>
    );

  const error =
    action.error instanceof ApiRequestError ? action.error : undefined;
  const key = errorKey(action.error, action.uncertain);
  const fields = new Set(error?.fields.map(({ path }) => path));
  const inputError = (name: keyof ContactValues) =>
    form.formState.errors[name]?.message ??
    (fields.has(name) ? t("invalid") : undefined);
  const validText = (value: string, max: number) => {
    const text = value.trim();
    return (
      (text.length > 0 &&
        [...text].length <= max &&
        !/[\p{Cc}\p{Cs}]/u.test(text)) ||
      t("textLimit", { max })
    );
  };
  const waiting = busy || action.busy;
  return (
    <form noValidate onSubmit={submit}>
      <Stack>
        <TextInput
          label={t("name")}
          autoComplete="name"
          required
          error={inputError("contactName")}
          readOnly={waiting || action.uncertain}
          {...form.register("contactName", {
            validate: (value) => validText(value, 80),
          })}
        />
        <TextInput
          label={t("phone")}
          type="tel"
          autoComplete="tel"
          required
          error={inputError("phone")}
          readOnly={waiting || action.uncertain}
          {...form.register("phone", {
            validate: (value) => phoneValid(value) || t("invalidPhone"),
          })}
        />
        <NativeSelect
          label={t("channel")}
          error={inputError("contactChannel")}
          disabled={waiting || action.uncertain}
          data={channels.map((value) => ({ value, label: t(value) }))}
          {...form.register("contactChannel")}
        />
        <TextInput
          label={t("contact", { channel: t(channel) })}
          required
          error={inputError("contactValue")}
          readOnly={waiting || action.uncertain}
          {...form.register("contactValue", {
            validate: (value) =>
              validText(value, 200) === true
                ? !/[<>]/.test(value) || t("invalid")
                : t("textLimit", { max: 200 }),
          })}
        />
        <Checkbox
          label={t("consent")}
          error={inputError("privacyConsent")}
          disabled={waiting || action.uncertain}
          {...form.register("privacyConsent", {
            validate: (value) => value || t("consentRequired"),
          })}
        />
        {action.error != null &&
          (fields.size === 0 || error?.status !== 422) && (
            <Alert role="alert" color="red">
              <Text>{t(key)}</Text>
              {action.remaining > 0 && (
                <Text>{t("wait", { seconds: action.remaining })}</Text>
              )}
              {key === "expired" && (
                <Anchor
                  href={LOGIN_ROUTE}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("login")}
                </Anchor>
              )}
            </Alert>
          )}
        {verify &&
          (key === "changed" || key === "alreadyOpen" || action.uncertain) && (
            <Button
              type="button"
              variant="default"
              onClick={() => void verify()}
              disabled={waiting}
            >
              {t("refresh")}
            </Button>
          )}
        <Button
          type="submit"
          autoContrast
          loading={waiting}
          disabled={key === "keyConflict" || action.remaining > 0}
        >
          {t(action.uncertain ? "retry" : "send")}
        </Button>
      </Stack>
    </form>
  );
}
