"use client";

import { useTranslations } from "next-intl";
import {
  SessionFailure,
  SessionLoading,
  usePrivateSession,
} from "@entities/identity";
import { Text } from "@shared/ui";
import { RsvpDashboard } from "@widgets/rsvp-dashboard";

export function ResponsesSession({ projectId }: { projectId: string }) {
  const t = useTranslations("Account");
  const { session, unauthorized } = usePrivateSession();
  if (unauthorized) return <Text role="status">{t("expired")}</Text>;
  if (session.isPending) return <SessionLoading />;
  if (session.isError || !session.data)
    return <SessionFailure retry={() => void session.refetch()} />;

  return (
    <RsvpDashboard
      key={session.data.user.id + projectId}
      scope={{ kind: "owner", id: projectId }}
    />
  );
}
