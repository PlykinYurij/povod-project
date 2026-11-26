"use client";

import { useTranslations } from "next-intl";
import {
  SessionFailure,
  SessionLoading,
  usePrivateSession,
} from "@entities/identity";
import { Alert, Text } from "@shared/ui";
import { ApiRequestError, useGetProject } from "@shared/api";
import { GardenEditor, TogetherEditor } from "@features/edit-garden-draft";

export function EditorSession({ projectId }: { projectId: string }) {
  const t = useTranslations("Account");
  const { session, unauthorized } = usePrivateSession({ checkOnFocus: false });
  if (unauthorized) return <Text role="status">{t("expired")}</Text>;
  if (session.isPending) return <SessionLoading />;
  if (!session.data)
    return <SessionFailure retry={() => void session.refetch()} />;
  return <EditorContent key={session.data.user.id} projectId={projectId} />;
}

function EditorContent({ projectId }: { projectId: string }) {
  const t = useTranslations("DraftEditor");
  const project = useGetProject(projectId, {
    query: {
      retry: false,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });
  if (
    project.isPending ||
    (project.isFetching && !project.isFetchedAfterMount)
  ) {
    return <SessionLoading />;
  }
  if (
    project.error instanceof ApiRequestError &&
    project.error.status === 404
  ) {
    return (
      <Alert role="alert" color="red">
        {t("missing")}
      </Alert>
    );
  }
  if (!project.data || project.isError) {
    return <SessionFailure retry={() => void project.refetch()} />;
  }
  if (!project.data.canEditDraft) return <Alert>{t("locked")}</Alert>;
  if (
    project.data.templateVersionId === "wedding-together-v1" &&
    "photo" in project.data.content
  )
    return (
      <TogetherEditor
        project={project.data}
        photoSource={{ kind: "owner", id: projectId }}
      />
    );
  if (
    project.data.templateVersionId !== "wedding-garden-v1" ||
    !("program" in project.data.content)
  )
    return <Alert>{t("unsupported")}</Alert>;
  return (
    <GardenEditor
      project={project.data}
      photoSource={{ kind: "owner", id: projectId }}
    />
  );
}
