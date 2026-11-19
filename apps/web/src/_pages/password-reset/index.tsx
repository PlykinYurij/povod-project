import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PasswordResetForm } from "@features/password-reset";
import { IdentityShell } from "@widgets/identity-shell";
import { Title } from "@shared/ui";
import styles from "@shared/ui/identity-form/form.module.css";

export async function PasswordResetPage() {
  const t = await getTranslations("Identity");
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
