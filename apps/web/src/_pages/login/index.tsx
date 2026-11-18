"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, useGetSession } from "@povod/api-client";
import { Alert, Button, Group, Loader, Title, Text } from "../../shared/ui";
import { IdentityShell } from "../../widgets/identity-shell";
import { SignInForm } from "../../features/sign-in";
import styles from "../../widgets/identity-shell/identity-shell.module.css";
import { safeReturnTo } from "../../shared/config/auth-navigation";

export function LoginPage({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const account = useTranslations("Account");
  const router = useRouter();
  const [checkedGuest, setCheckedGuest] = useState(false);
  const session = useGetSession({
    query: {
      retry: false,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const unauthorized =
    session.error instanceof ApiRequestError && session.error.status === 401;
  const authenticated =
    !!session.data && !session.isError && !session.isFetching;
  useEffect(() => {
    if (unauthorized) setCheckedGuest(true);
  }, [unauthorized]);
  useEffect(() => {
    if (authenticated) router.replace(safeReturnTo(returnTo));
  }, [authenticated, returnTo, router]);
  let content;
  if (
    authenticated ||
    (!checkedGuest && (session.isPending || session.isFetching))
  )
    content = (
      <Group role="status">
        <Loader size="sm" />
        <Text>{common("loading")}</Text>
      </Group>
    );
  else if (session.isError && !unauthorized)
    content = (
      <Alert color="red" role="alert">
        {account("error")}
        <Button mt="md" onClick={() => void session.refetch()}>
          {common("retry")}
        </Button>
      </Alert>
    );
  else if (checkedGuest)
    content = (
      <>
        <Text className={styles.muted} mt="sm">
          {t("intro")}
        </Text>
        <SignInForm returnTo={returnTo} />
        <p className={styles.foot}>{t("future")}</p>
      </>
    );
  else content = <Text role="status">{common("loading")}</Text>;
  return (
    <IdentityShell>
      <Title order={1} className={styles.title}>
        {t("title")}
      </Title>
      {content}
    </IdentityShell>
  );
}
