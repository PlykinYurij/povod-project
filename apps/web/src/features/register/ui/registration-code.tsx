"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSessionQueryKey,
  useConfirmRegistration,
  useResendRegistrationCode,
} from "@shared/api";
import { Alert, Button, Text } from "@shared/ui";
import { EmailCodeInput, IdentityError } from "@entities/identity";
import { hasFieldError, identityErrorKey } from "@shared/api/identity-errors";
import { validEmailCode } from "@shared/lib/identity-validation";
import { useFormAction } from "@shared/lib/use-form-action";
import { clearPrivateQueries } from "@shared/api/private-cache";
import { safeReturnTo } from "@shared/config/auth-navigation";
import styles from "@shared/ui/identity-form/form.module.css";
import type { PendingRegistration } from "../model";

export function RegistrationCode({
  pending: initial,
  onRestart,
  returnTo,
}: {
  pending: PendingRegistration;
  onRestart: () => void;
  returnTo: string;
}) {
  const t = useTranslations("Identity");
  const router = useRouter();
  const client = useQueryClient();
  const confirm = useConfirmRegistration({ mutation: { gcTime: 0 } });
  const resend = useResendRegistrationCode({ mutation: { gcTime: 0 } });
  const action = useFormAction();
  const form = useForm<{ code: string }>({ defaultValues: { code: "" } });
  const [pending, setPending] = useState(initial);
  const [resent, setResent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expired, setExpired] = useState(false);
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    const update = () =>
      setExpired(Date.now() >= Date.parse(pending.expiresAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [pending.expiresAt]);
  const submit = form.handleSubmit(async ({ code }) => {
    if (expired) return;
    setConfirming(true);
    setResent(false);
    await action.run(
      async () => {
        try {
          return await confirm.mutateAsync({
            data: { registrationId: pending.registrationId, code },
          });
        } finally {
          confirm.reset();
        }
      },
      async (result) => {
        await clearPrivateQueries(client);
        if (!action.isActive()) return;
        form.reset();
        client.setQueryData(getGetSessionQueryKey(), result);
        router.replace(safeReturnTo(returnTo));
      },
    );
  });
  async function sendAgain() {
    setConfirming(false);
    setResent(false);
    await action.run(
      async () => {
        try {
          return await resend.mutateAsync({
            data: { registrationId: pending.registrationId },
          });
        } finally {
          resend.reset();
        }
      },
      (result) => {
        setPending({ ...result, email: pending.email });
        setResent(true);
        form.reset();
        form.setFocus("code");
      },
    );
  }
  const codeError =
    form.formState.errors.code?.message ??
    (hasFieldError(action.error, "code") ? t("codeFormat") : undefined) ??
    (identityErrorKey(action.error) === "invalidCode"
      ? t("codeRejected")
      : undefined);
  return (
    <form
      noValidate
      onSubmit={submit}
      className={styles.form}
      aria-busy={action.busy}
    >
      <Text ref={heading} tabIndex={-1}>
        {t("registrationCode", { email: pending.email })}
      </Text>
      <IdentityError
        error={action.error}
        remaining={action.remaining}
        confirming={confirming}
      />
      {expired && (
        <Alert color="yellow" role="status">
          {t("expired")}
        </Alert>
      )}
      {resent && <Text role="status">{t("resent")}</Text>}
      <EmailCodeInput
        {...form.register("code", {
          validate: (value) => validEmailCode(value) || t("codeFormat"),
        })}
        disabled={action.busy}
        error={codeError}
      />
      <Button
        type="submit"
        className={styles.primary}
        loading={action.busy}
        disabled={action.busy || action.remaining > 0 || expired}
      >
        {t("confirmRegistration")}
      </Button>
      <Button
        type="button"
        variant="light"
        onClick={() => void sendAgain()}
        disabled={action.busy || action.remaining > 0}
      >
        {t("resend")}
      </Button>
      <Button
        type="button"
        variant="subtle"
        onClick={onRestart}
        disabled={action.busy}
      >
        {t("changeEmail")}
      </Button>
      <Text size="sm">{t("codeRules")}</Text>
    </form>
  );
}
