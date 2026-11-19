"use client";
import { useTranslations } from "next-intl";
import { passwordRules } from "@shared/lib/identity-validation";
import styles from "../password-fields.module.css";

export function PasswordChecklist({ value }: { value: string }) {
  const t = useTranslations("Identity");
  return (
    <span
      role="list"
      aria-label={t("passwordRequirements")}
      className={styles.rules}
    >
      {Object.entries(passwordRules(value)).map(([rule, passed]) => (
        <span
          key={rule}
          role="listitem"
          className={passed ? styles.passed : styles.missing}
          aria-label={`${t(`rule_${rule}`)}: ${t(passed ? "ruleMet" : "ruleMissing")}`}
        >
          <span aria-hidden="true" className={styles.marker}>
            {passed ? "✓" : "○"}
          </span>
          {t(`rule_${rule}`)}
        </span>
      ))}
    </span>
  );
}
