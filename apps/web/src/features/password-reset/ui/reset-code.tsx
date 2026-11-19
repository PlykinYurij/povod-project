"use client";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRequestPasswordReset, useConfirmPasswordReset } from "@shared/api";
import { Button, Text } from "@shared/ui";
import {
  EmailCodeInput,
  NewPasswordFields,
  IdentityError,
  type NewPasswordValues,
} from "@entities/identity";
import { hasFieldError, identityErrorKey } from "@shared/api/identity-errors";
import { validEmailCode } from "@shared/lib/identity-validation";
import { useFormAction } from "@shared/lib/use-form-action";
import { clearPrivateQueries } from "@shared/api/private-cache";
import styles from "@shared/ui/identity-form/form.module.css";

interface ResetValues extends NewPasswordValues {
  code: string;
}

export function ResetCode({
  email,
  onRestart,
  onComplete,
}: {
  email: string;
  onRestart: () => void;
  onComplete: () => void;
}) {
  const t = useTranslations("Identity");
  const confirm = useConfirmPasswordReset({ mutation: { gcTime: 0 } });
  const resend = useRequestPasswordReset({ mutation: { gcTime: 0 } });
  const client = useQueryClient();
  const action = useFormAction();
  const form = useForm<ResetValues>({
    defaultValues: { code: "", password: "", passwordConfirmation: "" },
  });
  const [confirming, setConfirming] = useState(false);
  const [resent, setResent] = useState(false);
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const submit = form.handleSubmit(async ({ code, password }) => {
    setConfirming(true);
    setResent(false);
    await action.run(
      async () => {
        try {
          return await confirm.mutateAsync({
            data: { email, code, newPassword: password },
          });
        } finally {
          confirm.reset();
        }
      },
      async () => {
        await clearPrivateQueries(client);
        if (!action.isActive()) return;
        form.reset();
        onComplete();
      },
    );
  });
  async function sendAgain() {
    setConfirming(false);
    setResent(false);
    await action.run(
      async () => {
        try {
          return await resend.mutateAsync({ data: { email } });
        } finally {
          resend.reset();
        }
      },
      () => {
        setResent(true);
        // Keep the new password local; reset only the obsolete code and its validation.
        form.resetField("code");
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
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={submit}
        className={styles.form}
        aria-busy={action.busy}
      >
        <Text ref={heading} tabIndex={-1}>
          {t("resetCode", { email })}
        </Text>
        <IdentityError
          error={action.error}
          remaining={action.remaining}
          confirming={confirming}
        />
        {resent && <Text role="status">{t("resetResent")}</Text>}
        <EmailCodeInput
          {...form.register("code", {
            validate: (value) => validEmailCode(value) || t("codeFormat"),
          })}
          disabled={action.busy}
          error={codeError}
        />
        <NewPasswordFields
          disabled={action.busy}
          serverError={hasFieldError(action.error, "newPassword")}
        />
        <Button
          type="submit"
          className={styles.primary}
          loading={action.busy}
          disabled={action.busy || action.remaining > 0}
        >
          {t("changePassword")}
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
    </FormProvider>
  );
}
