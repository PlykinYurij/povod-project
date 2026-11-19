"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRequestPasswordReset,
  useConfirmPasswordReset,
} from "@povod/api-client";
import { Alert, Button, Text, TextInput } from "../../shared/ui";
import {
  EmailCodeInput,
  NewPasswordFields,
  IdentityError,
} from "../../entities/identity";
import {
  hasFieldError,
  identityErrorKey,
} from "../../shared/api/identity-errors";
import {
  validEmailCode,
  validNewPassword,
  validEmail,
  passwordsMatch,
} from "../../shared/lib/identity-validation";
import { useFormAction } from "../../shared/lib/use-form-action";
import { clearPrivateQueries } from "../../shared/api/private-cache";
import styles from "../../shared/ui/identity-form/form.module.css";

export function PasswordResetForm() {
  const [email, setEmail] = useState<string>();
  const [complete, setComplete] = useState(false);
  const t = useTranslations("Identity");
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (complete) heading.current?.focus();
  }, [complete]);
  if (complete)
    return (
      <div ref={heading} tabIndex={-1} className={styles.form}>
        <Alert color="green" role="status">
          {t("resetSuccess")}
        </Alert>
        <Link href="/login">{t("backToLogin")}</Link>
      </div>
    );
  return email === undefined ? (
    <ResetStart onAccepted={setEmail} />
  ) : (
    <ResetCode
      email={email}
      onRestart={() => setEmail(undefined)}
      onComplete={() => setComplete(true)}
    />
  );
}

function ResetStart({ onAccepted }: { onAccepted: (email: string) => void }) {
  const t = useTranslations("Identity"),
    auth = useTranslations("Auth");
  const mutation = useRequestPasswordReset({ mutation: { gcTime: 0 } });
  const action = useFormAction();
  const [invalidEmail, setInvalidEmail] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    setInvalidEmail(!validEmail(email));
    if (!validEmail(email)) return;
    await action.run(
      async () => {
        try {
          return await mutation.mutateAsync({ data: { email } });
        } finally {
          mutation.reset();
        }
      },
      () => onAccepted(email),
    );
  }
  return (
    <form
      noValidate
      onSubmit={submit}
      className={styles.form}
      aria-busy={action.busy}
    >
      <Text>{t("resetIntro")}</Text>
      <IdentityError error={action.error} remaining={action.remaining} />
      <TextInput
        label={auth("email")}
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        disabled={action.busy}
        error={
          invalidEmail || hasFieldError(action.error, "email")
            ? auth("emailInvalid")
            : undefined
        }
      />
      <Button
        type="submit"
        className={styles.primary}
        loading={action.busy}
        disabled={action.busy || action.remaining > 0}
      >
        {t("sendCode")}
      </Button>
      <Text size="sm">{t("memoryNotice")}</Text>
    </form>
  );
}

function ResetCode({
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
  const client = useQueryClient(),
    action = useFormAction();
  const [confirming, setConfirming] = useState(false),
    [resent, setResent] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false),
    [invalidPassword, setInvalidPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null),
    heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const code = String(values.get("code") ?? ""),
      newPassword = String(values.get("newPassword") ?? "");
    const confirmation = String(values.get("passwordConfirmation") ?? "");
    setSubmitted(true);
    setInvalidCode(!validEmailCode(code));
    setInvalidPassword(!validNewPassword(newPassword));
    if (
      !validEmailCode(code) ||
      !validNewPassword(newPassword) ||
      !passwordsMatch(newPassword, confirmation)
    )
      return;
    setConfirming(true);
    setResent(false);
    await action.run(
      async () => {
        try {
          return await confirm.mutateAsync({
            data: { email, code, newPassword },
          });
        } finally {
          confirm.reset();
        }
      },
      async () => {
        await clearPrivateQueries(client);
        if (!action.isActive()) return;
        formRef.current?.reset();
        onComplete();
      },
    );
  }
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
        setInvalidCode(false);
        // Keep the new password local; only the obsolete code needs replacing.
        const input =
          formRef.current?.querySelector<HTMLInputElement>(
            'input[name="code"]',
          );
        if (input) {
          input.value = "";
          input.focus();
        }
      },
    );
  }
  return (
    <form
      noValidate
      ref={formRef}
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
        disabled={action.busy}
        error={invalidCode || hasFieldError(action.error, "code")}
        rejected={
          !!action.error && identityErrorKey(action.error) === "invalidCode"
        }
      />
      <NewPasswordFields
        submitted={submitted}
        name="newPassword"
        disabled={action.busy}
        error={invalidPassword || hasFieldError(action.error, "newPassword")}
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
  );
}
