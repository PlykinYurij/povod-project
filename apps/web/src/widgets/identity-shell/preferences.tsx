"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { Button } from "../../shared/ui";
import { LOCALE_COOKIE, parseLocale } from "../../shared/config/locale";
import styles from "./identity-shell.module.css";

export function Preferences() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("light");
  return (
    <div className={styles.controls}>
      <label>
        {t("language")}{" "}
        <select
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
      </label>
      <Button
        variant="default"
        onClick={toggleColorScheme}
        aria-pressed={colorScheme === "dark"}
      >
        {t("theme")}
      </Button>
    </div>
  );
}
