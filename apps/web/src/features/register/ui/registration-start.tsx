"use client";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useRegister } from "@shared/api";
import { Button, Text, TextInput } from "@shared/ui";
import {
  EmailInput,
  NewPasswordFields,
  IdentityError,
  type NewPasswordValues,
} from "@entities/identity";
import { hasFieldError, identityErrorKey } from "@shared/api/identity-errors";
import { validEmail, validUserName } from "@shared/lib/identity-validation";
import { useFormAction } from "@shared/lib/use-form-action";
import styles from "@shared/ui/identity-form/form.module.css";
import type { PendingRegistration } from "../model";

interface RegistrationValues extends NewPasswordValues {
  email: string;
  userName: string;
}

export function RegistrationStart({
  onPending,
}: {
  onPending: (pending: PendingRegistration) => void;
}) {
  const t = useTranslations("Identity");
  const auth = useTranslations("Auth");
  const mutation = useRegister({ mutation: { gcTime: 0 } });
  const action = useFormAction();
  const form = useForm<RegistrationValues>({
    defaultValues: {
      email: "",
      userName: "",
      password: "",
      passwordConfirmation: "",
    },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit(async ({ email, userName, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    await action.run(
      async () => {
        try {
          return await mutation.mutateAsync({
            data: {
              email: normalizedEmail,
              userName: userName.trim(),
              password,
            },
          });
        } finally {
          mutation.reset();
        }
      },
      (result) => {
        form.reset();
        onPending({ ...result, email: normalizedEmail });
      },
    );
  });
  const emailError =
    identityErrorKey(action.error) === "emailUnavailable"
      ? t("emailUnavailable")
      : (errors.email?.message ??
        (hasFieldError(action.error, "email")
          ? auth("emailInvalid")
          : undefined));
  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={submit}
        className={styles.form}
        aria-busy={action.busy}
      >
        <Text>{t("registrationIntro")}</Text>
        <IdentityError error={action.error} remaining={action.remaining} />
        <TextInput
          {...form.register("userName", {
            validate: (value) => validUserName(value) || t("nameInvalid"),
          })}
          label={t("userName")}
          autoComplete="given-name"
          maxLength={80}
          required
          disabled={action.busy}
          error={
            errors.userName?.message ??
            (hasFieldError(action.error, "userName")
              ? t("nameInvalid")
              : undefined)
          }
        />
        <EmailInput
          {...form.register("email", {
            validate: (value) =>
              validEmail(value.trim()) || auth("emailInvalid"),
          })}
          disabled={action.busy}
          error={emailError}
        />
        <NewPasswordFields
          disabled={action.busy}
          serverError={hasFieldError(action.error, "password")}
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
    </FormProvider>
  );
}
