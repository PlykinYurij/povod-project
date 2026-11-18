"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, useGetSession, useLogout } from "@povod/api-client";
import { Alert, Button, Group, Loader, Text, Title } from "../../shared/ui";
import { clearPrivateQueries } from "../../shared/api/private-cache";
import { useSignOut } from "../../features/sign-out";
import { IdentityShell } from "../../widgets/identity-shell";
import styles from "../../widgets/identity-shell/identity-shell.module.css";

export function AccountPage() {
  const t = useTranslations("Account"),
    auth = useTranslations("Auth"),
    common = useTranslations("Common");
  const router = useRouter(),
    client = useQueryClient();
  const { signOut, leaving, failed: logoutFailed } = useSignOut();
  const session = useGetSession({
    query: { enabled: !leaving, retry: false, refetchOnWindowFocus: true },
  });
  const unauthorized =
    session.error instanceof ApiRequestError && session.error.status === 401;
  useEffect(() => {
    if (unauthorized) {
      void clearPrivateQueries(client).then(() => router.replace("/login"));
    }
  }, [unauthorized, client, router]);
  let content;
  if (leaving)
    content = logoutFailed ? (
      <Alert color="red" role="alert">
        {auth("logoutFailed")}
        <Button onClick={signOut} mt="md">
          {common("retry")}
        </Button>
      </Alert>
    ) : (
      <Text role="status">{auth("loggingOut")}</Text>
    );
  else if (unauthorized) content = <Text role="status">{t("expired")}</Text>;
  else if (session.isPending || session.isFetching)
    content = (
      <Group role="status">
        <Loader size="sm" />
        <Text>{common("loading")}</Text>
      </Group>
    );
  else if (session.isError)
    content = (
      <Alert color="red" role="alert">
        {t("error")}
        <Button onClick={() => void session.refetch()} mt="md">
          {common("retry")}
        </Button>
      </Alert>
    );
  else
    content = (
      <>
        <Group justify="space-between">
          <Text className={styles.email}>
            {t("signedIn", { email: session.data.user.email })}
          </Text>
          <Button onClick={signOut}>{auth("logout")}</Button>
        </Group>
        <div className={styles.empty}>
          <Title order={2} className={styles.title}>
            {t("empty")}
          </Title>
          <Text className={styles.muted} mt="md">
            {t("description")}
          </Text>
        </div>
      </>
    );
  return (
    <IdentityShell account>
      <Title order={1} className={styles.title} mb="lg">
        {t("title")}
      </Title>
      {content}
    </IdentityShell>
  );
}
