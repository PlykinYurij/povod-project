"use client";

import { useFormatter, useTranslations } from "next-intl";
import { PublishedLink } from "@features/publish-request";
import { ResumeProjectAction } from "@features/resume-project";
import { UnpublishProjectAction } from "@features/unpublish-project";
import type {
  AdminRequestDetailDto,
  PublicationLifecycleDto,
} from "@shared/api";
import { Stack, Text } from "@shared/ui";

export function RequestPublication({
  project,
  lifecycle,
  receipt,
  refresh,
}: {
  project: { id: string; revision: number };
  lifecycle: PublicationLifecycleDto;
  receipt: AdminRequestDetailDto["publication"];
  refresh: (throwOnError?: boolean) => Promise<unknown>;
}) {
  const t = useTranslations("AdminUnpublish");
  const format = useFormatter();
  return (
    <Stack>
      <Text role="status" fw={600}>
        {t(lifecycle.status)}
      </Text>
      {lifecycle.status === "PAUSED" && lifecycle.remainingMs !== null && (
        <Text>
          {t("remaining", {
            hours: Math.ceil(lifecycle.remainingMs / 3_600_000),
          })}
        </Text>
      )}
      {(lifecycle.status === "PUBLISHED" ||
        lifecycle.status === "UNPUBLISHED") &&
        lifecycle.expiresAt && (
          <Text>
            {t("expires", {
              date: format.dateTime(new Date(lifecycle.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </Text>
        )}
      {lifecycle.status === "PUBLISHED" && (
        <>
          {receipt && <PublishedLink receipt={receipt} />}
          <UnpublishProjectAction
            key={`${project.id}:${project.revision}:${lifecycle.publicationVersion}`}
            projectId={project.id}
            projectRevision={project.revision}
            publicationVersion={lifecycle.publicationVersion}
            refresh={refresh}
          />
        </>
      )}
      {(lifecycle.status === "PAUSED" || lifecycle.status === "UNPUBLISHED") && (
        <ResumeProjectAction
          key={`${project.id}:${project.revision}:${lifecycle.publicationVersion}`}
          projectId={project.id}
          projectRevision={project.revision}
          publicationVersion={lifecycle.publicationVersion}
          refresh={() => refresh(true)}
        />
      )}
    </Stack>
  );
}
