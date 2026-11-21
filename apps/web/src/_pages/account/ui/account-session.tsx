"use client";
import { useTranslations } from "next-intl";
import { useSignOut } from "@features/sign-out";
import {
  SessionLoading,
  SessionFailure,
  usePrivateSession,
} from "@entities/identity";
import { Text } from "@shared/ui";
import { AccountOverview } from "./account-overview";
import { LogoutStatus } from "./logout-status";

export function AccountSession() {
  const t = useTranslations("Account");
  const { signOut, leaving, failed } = useSignOut();
  const { session, unauthorized } = usePrivateSession({ leaving });
  if (leaving) return <LogoutStatus failed={failed} retry={signOut} />;
  if (unauthorized) return <Text role="status">{t("expired")}</Text>;
  if (session.isPending || session.isFetching) return <SessionLoading />;
  if (session.isError)
    return <SessionFailure retry={() => void session.refetch()} />;
  return <AccountOverview user={session.data.user} signOut={signOut} />;
}
