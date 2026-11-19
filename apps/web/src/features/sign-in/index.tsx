"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, getGetSessionQueryKey, useLogin } from "@shared/api";
import { Alert, Button, PasswordInput } from "@shared/ui";
import { EmailInput } from "@entities/identity";
import { clearPrivateQueries } from "@shared/api/private-cache";
import { signInErrorKey } from "./error-message";
import { useFormAction } from "@shared/lib/use-form-action";
import styles from "@shared/ui/identity-form/form.module.css";
import { safeReturnTo } from "@shared/config/auth-navigation";
import { validEmail } from "@shared/lib/identity-validation";
import {
  hasFieldError,
  hasInlineFieldErrors,
} from "@shared/api/identity-errors";
interface SignInValues {
  email: string;
  password: string;
}
export function SignInForm({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Auth");
  const client = useQueryClient();
  const router = useRouter();
  const mutation = useLogin({ mutation: { gcTime: 0 } });
  const action = useFormAction();
  const [visible, setVisible] = useState(false);
  const form = useForm<SignInValues>({
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit(async ({ email, password }) => {
    await action.run(
      async () => {
        await clearPrivateQueries(client);
        if (!action.isActive()) return undefined;
        try {
          return await mutation.mutateAsync({
            data: { email: email.trim().toLowerCase(), password },
          });
        } finally {
          mutation.reset();
        }
      },
      async (result) => {
        if (!result) return;
        await clearPrivateQueries(client);
        if (!action.isActive()) return;
        form.reset();
        client.setQueryData(getGetSessionQueryKey(), result);
        router.replace(safeReturnTo(returnTo));
      },
    );
  });
  const unauthorized =
    action.error instanceof ApiRequestError && action.error.status === 401;
  const errorKey = signInErrorKey(action.error);
  const message =
    errorKey === "rate"
      ? action.remaining > 0
        ? t("rate", { seconds: action.remaining })
        : t("rateUnknown")
      : t(errorKey);
  const passwordError = unauthorized
    ? t("invalid")
    : (errors.password?.message ??
      (hasFieldError(action.error, "password")
        ? t("passwordInvalid")
        : undefined));
  return (
    <form
      noValidate
      onSubmit={submit}
      className={styles.form}
      aria-busy={action.busy}
    >
      {action.error &&
      !unauthorized &&
      !hasInlineFieldErrors(action.error, ["email", "password"]) ? (
        <Alert color="red" role="alert" className={styles.error}>
          {message}
        </Alert>
      ) : null}
      <EmailInput
        {...form.register("email", {
          validate: (value) => validEmail(value.trim()) || t("emailInvalid"),
        })}
        disabled={action.busy}
        error={
          errors.email?.message ??
          (hasFieldError(action.error, "email") ? t("emailInvalid") : undefined)
        }
      />
      <PasswordInput
        {...form.register("password", {
          validate: (value) =>
            (value.length >= 1 && value.length <= 128) || t("passwordInvalid"),
        })}
        label={t("password")}
        autoComplete="current-password"
        minLength={1}
        maxLength={128}
        required
        disabled={action.busy}
        visible={visible}
        onVisibilityChange={setVisible}
        visibilityToggleButtonProps={{
          "aria-label": t(visible ? "hide" : "show"),
        }}
        error={passwordError}
      />
      <Button
        type="submit"
        loading={action.busy}
        disabled={action.busy || action.remaining > 0}
        className={styles.primary}
      >
        {t(action.busy ? "pending" : "submit")}
      </Button>
    </form>
  );
}
