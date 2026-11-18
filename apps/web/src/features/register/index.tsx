"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSessionQueryKey,
  useRegister,
  useConfirmRegistration,
  useResendRegistrationCode,
  type RegistrationPendingDto,
} from "@povod/api-client";
import { Alert, Button, Text, TextInput } from "../../shared/ui";
import {
  EmailCodeInput,
  NewPasswordInput,
  IdentityError,
} from "../../entities/identity";
import {
  hasFieldError,
  identityErrorKey,
} from "../../shared/api/identity-errors";
import {
  validNewPassword,
  validEmailCode,
} from "../../shared/lib/identity-validation";
import { useFormAction } from "../../shared/lib/use-form-action";
import { clearPrivateQueries } from "../../shared/api/private-cache";
import { safeReturnTo } from "../../shared/config/auth-navigation";
import styles from "../../shared/ui/identity-form/form.module.css";

type Pending = RegistrationPendingDto & { email: string };

export function RegistrationForm({ returnTo }: { returnTo: string }) {
  const [pending, setPending] = useState<Pending>();
  return pending ? (
    <RegistrationCode
      pending={pending}
      onRestart={() => setPending(undefined)}
      returnTo={returnTo}
    />
  ) : (
    <RegistrationStart onPending={setPending} />
  );
}

function RegistrationStart({
  onPending,
}: {
  onPending: (pending: Pending) => void;
}) {
  const t = useTranslations("Identity"),
    auth = useTranslations("Auth");
  const mutation = useRegister({ mutation: { gcTime: 0 } });
  const action = useFormAction();
  const [invalidPassword, setInvalidPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    const email = String(values.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(values.get("password") ?? "");
    setInvalidPassword(!validNewPassword(password));
    if (!validNewPassword(password)) return;
    await action.run(
      async () => {
        try {
          return await mutation.mutateAsync({ data: { email, password } });
        } finally {
          mutation.reset();
        }
      },
      (result) => {
        form.reset();
        onPending({ ...result, email });
      },
    );
  }
  return (
    <form onSubmit={submit} className={styles.form} aria-busy={action.busy}>
      <Text>{t("registrationIntro")}</Text>
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
          hasFieldError(action.error, "email")
            ? auth("emailInvalid")
            : undefined
        }
      />
      <NewPasswordInput
        disabled={action.busy}
        error={invalidPassword || hasFieldError(action.error, "password")}
      />
      <Button
        type="submit"
        className={styles.primary}
        loading={action.busy}
        disabled={action.busy || action.remaining > 0}
      >
        {t("register")}
      </Button>
      <Text size="sm">{t("memoryNotice")}</Text>
    </form>
  );
}

function RegistrationCode({
  pending: initial,
  onRestart,
  returnTo,
}: {
  pending: Pending;
  onRestart: () => void;
  returnTo: string;
}) {
  const t = useTranslations("Identity");
  const router = useRouter(),
    client = useQueryClient();
  const confirm = useConfirmRegistration({ mutation: { gcTime: 0 } });
  const resend = useResendRegistrationCode({ mutation: { gcTime: 0 } });
  const action = useFormAction();
  const [pending, setPending] = useState(initial);
  const [resent, setResent] = useState(false),
    [invalidCode, setInvalidCode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expired, setExpired] = useState(false);
  const formRef = useRef<HTMLFormElement>(null),
    heading = useRef<HTMLParagraphElement>(null);
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    setInvalidCode(!validEmailCode(code));
    if (!validEmailCode(code)) return;
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
        client.setQueryData(getGetSessionQueryKey(), result);
        router.replace(safeReturnTo(returnTo));
      },
    );
  }
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
        setInvalidCode(false);
        setResent(true);
        formRef.current?.reset();
        formRef.current
          ?.querySelector<HTMLInputElement>('input[name="code"]')
          ?.focus();
      },
    );
  }
  return (
    <form
      ref={formRef}
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
        disabled={action.busy}
        error={invalidCode || hasFieldError(action.error, "code")}
        rejected={
          !!action.error && identityErrorKey(action.error) === "invalidCode"
        }
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
