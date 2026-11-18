"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { RegistrationForm } from "../../features/register";
import { IdentityShell } from "../../widgets/identity-shell";
import { Title } from "../../shared/ui";
import { loginHref } from "../../shared/config/auth-navigation";
import styles from "../../shared/ui/identity-form/form.module.css";

export function RegisterPage({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Identity");
  return (
    <IdentityShell>
      <Title order={1}>{t("registrationTitle")}</Title>
      <RegistrationForm returnTo={returnTo} />
      <nav className={styles.links} aria-label={t("navigation")}>
        <Link href={loginHref(returnTo)}>{t("backToLogin")}</Link>
        <Link href="/password-reset">{t("forgotPassword")}</Link>
      </nav>
    </IdentityShell>
  );
}
