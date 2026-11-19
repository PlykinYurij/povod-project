"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiRequestError,
  getGetSessionQueryKey,
  useLogin,
} from "@povod/api-client";
import { Alert, Button, PasswordInput, TextInput } from "../../shared/ui";
import { clearPrivateQueries } from "../../shared/api/private-cache";
import { signInErrorKey } from "./error-message";
import { useRetryAfter } from "../../shared/lib/use-retry-after";
import styles from "../../shared/ui/identity-form/form.module.css";
import { safeReturnTo } from "../../shared/config/auth-navigation";
import { validEmail } from "../../shared/lib/identity-validation";
import { hasInlineFieldErrors } from "../../shared/api/identity-errors";

export function SignInForm({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Auth");
  const client = useQueryClient();
  const router = useRouter();
  const mutation = useLogin();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [invalidPassword, setInvalidPassword] = useState(false);
  const active = useRef(true),
    submitting = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const remaining = useRetryAfter(
    error instanceof ApiRequestError ? error.retryAfter : undefined,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || remaining > 0) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(values.get("password") ?? "");
    setInvalidEmail(!validEmail(email));
    setInvalidPassword(password.length < 1 || password.length > 128);
    if (!validEmail(email) || password.length < 1 || password.length > 128)
      return;
    submitting.current = true;
    setError(undefined);
    setBusy(true);
    try {
      await clearPrivateQueries(client);
      if (!active.current) return;
      const result = await mutation.mutateAsync({ data: { email, password } });
      if (!active.current) return;
      await clearPrivateQueries(client);
      if (!active.current) return;
      client.setQueryData(getGetSessionQueryKey(), result);
      router.replace(safeReturnTo(returnTo));
    } catch (failure) {
      if (active.current) setError(failure);
    } finally {
      // TanStack mutation variables include the submitted password; do not retain them.
      mutation.reset();
      client.getMutationCache().clear();
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  const fields = error instanceof ApiRequestError ? error.fields : [];
  const message = error
    ? signInErrorKey(error) === "rate"
      ? error instanceof ApiRequestError && error.retryAfter
        ? t("rate", { seconds: remaining || error.retryAfter })
        : t("rateUnknown")
      : t(signInErrorKey(error))
    : undefined;
  return (
    <form noValidate onSubmit={submit} className={styles.form} aria-busy={busy}>
      {message &&
        !(error instanceof ApiRequestError && error.status === 401) &&
        !hasInlineFieldErrors(error, ["email", "password"]) && (
          <Alert color="red" role="alert" className={styles.error}>
            {message}
          </Alert>
        )}
      <TextInput
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        disabled={busy}
        error={
          invalidEmail || fields.some((field) => field.path === "email")
            ? t("emailInvalid")
            : undefined
        }
      />
      <PasswordInput
        label={t("password")}
        name="password"
        autoComplete="current-password"
        minLength={1}
        maxLength={128}
        required
        disabled={busy}
        visible={visible}
        onVisibilityChange={setVisible}
        visibilityToggleButtonProps={{
          "aria-label": t(visible ? "hide" : "show"),
        }}
        error={
          error instanceof ApiRequestError && error.status === 401
            ? t("invalid")
            : invalidPassword ||
                fields.some((field) => field.path === "password")
              ? t("passwordInvalid")
              : undefined
        }
      />
      <Button
        type="submit"
        loading={busy}
        disabled={busy || remaining > 0}
        className={styles.primary}
      >
        {t(busy ? "pending" : "submit")}
      </Button>
    </form>
  );
}
