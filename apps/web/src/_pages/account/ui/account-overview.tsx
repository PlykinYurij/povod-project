"use client";
import { useTranslations } from "next-intl";
import type { RegisteredUserDto } from "@shared/api";
import { Button, Group, Text, Title } from "@shared/ui";
import styles from "../account.module.css";

export function AccountOverview({
  user,
  signOut,
}: {
  user: RegisteredUserDto;
  signOut: () => void;
}) {
  const t = useTranslations("Account");
  const auth = useTranslations("Auth");
  return (
    <>
      <Group justify="space-between">
        {user.userName && <Text>{t("greeting", { name: user.userName })}</Text>}
        <Text className={styles.email}>
          {t("signedIn", { email: user.email })}
        </Text>
        <Button onClick={signOut}>{auth("logout")}</Button>
      </Group>
      <div className={styles.empty}>
        <Title order={2}>{t("empty")}</Title>
        <Text className={styles.muted} mt="md">
          {t("description")}
        </Text>
      </div>
    </>
  );
}
