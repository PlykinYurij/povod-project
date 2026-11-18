"use client";

import { useTranslations } from "next-intl";
import { Title, Text } from "../../shared/ui";
import { IdentityShell } from "../../widgets/identity-shell";
import { SignInForm } from "../../features/sign-in";
import styles from "../../widgets/identity-shell/identity-shell.module.css";

export function LoginPage() {
  const t = useTranslations("Auth");
  return (
    <IdentityShell>
      <Title order={1} className={styles.title}>
        {t("title")}
      </Title>
      <Text className={styles.muted} mt="sm">
        {t("intro")}
      </Text>
      <SignInForm />
      <p className={styles.foot}>{t("future")}</p>
    </IdentityShell>
  );
}
