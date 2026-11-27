"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  SessionFailure,
  SessionLoading,
  usePrivateSession,
} from "@entities/identity";
import { PrivateGardenPreview } from "@widgets/private-garden-preview";
import { PublicationRequestPanel } from "@features/request-service";
import { ApiRequestError, useGetProject } from "@shared/api";
import { projectEditorHref } from "@shared/config/project-navigation";
import { Alert, Anchor, Stack, Text } from "@shared/ui";
import { isGardenComplete } from "../model/is-garden-complete";

export function PreviewSession({ projectId }: { projectId: string }) {
  const t = useTranslations("Account");
  const { session, unauthorized } = usePrivateSession({ checkOnFocus: false });
  if (unauthorized) return <Text role="status">{t("expired")}</Text>;
  if (session.isPending) return <SessionLoading />;
  if (!session.data || session.isError)
    return <SessionFailure retry={() => void session.refetch()} />;
  return <SavedPreview projectId={projectId} key={session.data.user.id} />;
}

function SavedPreview({ projectId }: { projectId: string }) {
  const t = useTranslations("ProjectPreview");
  const project = useGetProject(projectId, {
    query: {
      retry: false,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
    },
  });
  if (project.isPending || (project.isFetching && !project.isFetchedAfterMount))
    return <SessionLoading />;
  if (project.error instanceof ApiRequestError && project.error.status === 404)
    return <Alert role="alert">{t("missing")}</Alert>;
  if (!project.data)
    return <SessionFailure retry={() => void project.refetch()} />;
  const saved = project.data;
  if (
    !(
      saved.templateVersionId === "wedding-garden-v1" &&
      "program" in saved.content
    ) &&
    !(
      saved.templateVersionId === "wedding-together-v1" &&
      "photo" in saved.content &&
      "names" in saved.content
    ) &&
    !(
      saved.templateVersionId === "birthday-confetti-v1" &&
      "celebrantName" in saved.content
    )
  )
    return <Alert role="alert">{t("unsupported")}</Alert>;
  const canRequestFirstPublication =
    saved.canEditDraft && saved.firstPublishedAt === null;

  return (
    <Stack gap="lg">
      {project.isError && <Alert role="alert">{t("refreshFailed")}</Alert>}
      <Text>{t("revision", { revision: saved.revision })}</Text>
      <Text>
        {t(isGardenComplete(saved) ? "contentComplete" : "incomplete")}
      </Text>
      {saved.canEditDraft && (
        <Anchor component={Link} href={projectEditorHref(projectId)}>
          {t("edit")}
        </Anchor>
      )}
      {canRequestFirstPublication && (
        <Anchor href="#publication-request">{t("requestJump")}</Anchor>
      )}
      <PrivateGardenPreview
        source={{ kind: "owner", id: projectId }}
        content={saved.content}
        rsvp={<p>{t("guestFormPreview")}</p>}
      />
      {canRequestFirstPublication && (
        <PublicationRequestPanel
          projectId={projectId}
          revision={saved.revision}
          projectUnavailable={project.isError}
          reloadProject={() => project.refetch().then(() => undefined)}
        />
      )}
    </Stack>
  );
}
