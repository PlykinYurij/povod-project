"use client";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useRequestPasswordReset } from "@shared/api";
import { Button, Text } from "@shared/ui";
import { EmailInput, IdentityError } from "@entities/identity";
import { hasFieldError } from "@shared/api/identity-errors";
import { validEmail } from "@shared/lib/identity-validation";
import { useFormAction } from "@shared/lib/use-form-action";
import styles from "@shared/ui/identity-form/form.module.css";

export function ResetStart({
  onAccepted,
}: {
  onAccepted: (email: string) => void;
}) {
  const t = useTranslations("Identity");
  const auth = useTranslations("Auth");
  const mutation = useRequestPasswordReset({ mutation: { gcTime: 0 } });
  const action = useFormAction();
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } });
  const submit = form.handleSubmit(async ({ email }) => {
    const normalizedEmail = email.trim().toLowerCase();
    await action.run(
      async () => {
        try {
          return await mutation.mutateAsync({
            data: { email: normalizedEmail },
          });
        } finally {
          mutation.reset();
        }
      },
      () => {
        form.reset();
        onAccepted(normalizedEmail);
      },
    );
  });
  return (
    <form
      noValidate
      onSubmit={submit}
      className={styles.form}
      aria-busy={action.busy}
    >
      <Text>{t("resetIntro")}</Text>
      <IdentityError error={action.error} remaining={action.remaining} />
      <EmailInput
        {...form.register("email", {
          validate: (value) => validEmail(value.trim()) || auth("emailInvalid"),
        })}
        disabled={action.busy}
        error={
          form.formState.errors.email?.message ??
          (hasFieldError(action.error, "email")
            ? auth("emailInvalid")
            : undefined)
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
