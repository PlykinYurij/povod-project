"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PasswordResetForm } from "../../features/password-reset";
import { IdentityShell } from "../../widgets/identity-shell";
import { Title } from "../../shared/ui";
import styles from "../../shared/ui/identity-form/form.module.css";

export function PasswordResetPage() {
  const t = useTranslations("Identity");
  return (
    <IdentityShell>
      <Title order={1}>{t("resetTitle")}</Title>
      <PasswordResetForm />
      <nav className={styles.links} aria-label={t("navigation")}>
        <Link href="/login">{t("backToLogin")}</Link>
      </nav>
    </IdentityShell>
  );
}
