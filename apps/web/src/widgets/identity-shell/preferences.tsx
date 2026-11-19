"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { ActionIcon } from "@shared/ui";
import { ThemeIcon } from "@shared/ui/theme-icon";
import { useEffect, useState } from "react";
import { LOCALE_COOKIE, parseLocale } from "@shared/config/locale";
import styles from "./identity-shell.module.css";

export function Preferences() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("light");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <div className={styles.controls}>
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) => {
          const value = parseLocale(event.target.value);
          document.cookie = `${LOCALE_COOKIE}=${value}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === "https:" ? "; Secure" : ""}`;
          router.refresh();
        }}
      >
        <option value="ru">RU</option>
        <option value="en">EN</option>
      </select>
      <ActionIcon
        variant="default"
        onClick={toggleColorScheme}
        aria-label={t("theme")}
        className={styles.themeToggle}
        // The saved browser theme is unknown during SSR. Keep hydration deterministic.
        aria-pressed={mounted && colorScheme === "dark"}
      >
        <ThemeIcon />
      </ActionIcon>
    </div>
  );
}
