"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert } from "@shared/ui";
import styles from "@shared/ui/identity-form/form.module.css";

export function ResetSuccess() {
  const t = useTranslations("Identity");
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div ref={heading} tabIndex={-1} className={styles.form}>
      <Alert color="green" role="status">
        {t("resetSuccess")}
      </Alert>
      <Link href="/login">{t("backToLogin")}</Link>
    </div>
  );
}
