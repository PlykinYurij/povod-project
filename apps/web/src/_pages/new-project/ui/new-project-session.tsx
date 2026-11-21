"use client";

import { useTranslations } from "next-intl";
import {
  SessionFailure,
  SessionLoading,
  usePrivateSession,
} from "@entities/identity";
import { Text } from "@shared/ui";
import { CreateProjectForm } from "@features/create-project";

export function NewProjectSession({
  templateVersionId,
  templateTitle,
}: {
  templateVersionId: string;
  templateTitle: string;
}) {
  const t = useTranslations("Account");
  const { session, unauthorized } = usePrivateSession();
  if (unauthorized) return <Text role="status">{t("expired")}</Text>;
  if (session.isPending) return <SessionLoading />;
  if (!session.data)
    return <SessionFailure retry={() => void session.refetch()} />;
  return (
    <CreateProjectForm
      key={`${session.data.user.id}:${templateVersionId}`}
      templateVersionId={templateVersionId}
      templateTitle={templateTitle}
      onUnauthorized={() => void session.refetch()}
    />
  );
}
