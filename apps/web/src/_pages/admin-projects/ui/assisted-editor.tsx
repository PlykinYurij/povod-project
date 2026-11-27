"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConfettiEditor,
  AnniversaryEditor,
  GardenEditor,
  TogetherEditor,
} from "@features/edit-garden-draft";
import {
  ApiRequestError,
  getAdminRequest,
  getGetAdminRequestQueryKey,
  getListAdminRequestsQueryKey,
  saveAssistedDraft,
  type AdminRequestDetailDto,
  type ProjectDto,
} from "@shared/api";
import { Button, Stack, Title } from "@shared/ui";

export function AssistedEditor({
  requestId,
  project,
}: {
  requestId: string;
  project: ProjectDto;
}) {
  const t = useTranslations("AdminRequests");
  const [editing, setEditing] = useState(false);
  const cache = useQueryClient();
  const Editor =
    project.templateVersionId === "birthday-anniversary-v1"
      ? AnniversaryEditor
      : project.templateVersionId === "birthday-confetti-v1"
        ? ConfettiEditor
        : project.templateVersionId === "wedding-together-v1"
          ? TogetherEditor
          : GardenEditor;
  if (!editing)
    return (
      <Button variant="light" w="fit-content" onClick={() => setEditing(true)}>
        {t("editDraft")}
      </Button>
    );
  return (
    <Stack>
      <Title order={3}>{t("editDraft")}</Title>
      <Editor
        project={project}
        photoSource={{ kind: "assisted", id: requestId }}
        access={{
          load: async (options) => {
            const record = await getAdminRequest(requestId, options);
            if (!record.project || record.project.id !== project.id)
              throw new ApiRequestError(404, "PROJECT_NOT_FOUND");
            return record.project;
          },
          save: (input, options) =>
            saveAssistedDraft(requestId, input, options),
          onProject: (updated) => {
            cache.setQueryData<AdminRequestDetailDto>(
              getGetAdminRequestQueryKey(requestId),
              (current) =>
                current?.project?.id === updated.id &&
                current.project.revision <= updated.revision
                  ? {
                      ...current,
                      project: updated,
                      projectTitle: updated.title,
                    }
                  : current,
            );
            void cache.invalidateQueries({
              queryKey: getListAdminRequestsQueryKey(),
            });
          },
        }}
      />
    </Stack>
  );
}
