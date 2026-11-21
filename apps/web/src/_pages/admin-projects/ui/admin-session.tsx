"use client";

import { useTranslations } from "next-intl";
import {
  SessionFailure,
  SessionLoading,
  usePrivateSession,
} from "@entities/identity";
import { ApiRequestError, useGetAdminAccess } from "@shared/api";
import { Alert, Text } from "@shared/ui";
import { RequestQueue } from "./request-queue";

export function AdminSession() {
  const t = useTranslations("Account");
  const { session, unauthorized } = usePrivateSession();
  if (unauthorized) return <Text role="status">{t("expired")}</Text>;
  if (session.isPending) return <SessionLoading />;
  if (!session.data || session.isError)
    return <SessionFailure retry={() => void session.refetch()} />;
  return <AdminAccess key={session.data.user.id} />;
}

function AdminAccess() {
  const t = useTranslations("AdminRequests");
  const access = useGetAdminAccess({
    query: { retry: false, refetchOnMount: "always" },
  });
  if (access.isPending || (access.isFetching && !access.isFetchedAfterMount))
    return <SessionLoading />;
  if (access.error instanceof ApiRequestError && access.error.status === 403)
    return <Alert role="alert">{t("forbidden")}</Alert>;
  if (!access.data || access.isError)
    return <SessionFailure retry={() => void access.refetch()} />;
  return <RequestQueue />;
}
