"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiRequestError,
  getGetProjectQueryKey,
  getGetProjectsQueryKey,
  getProject,
  saveProjectDraft,
  type ProjectDto,
  type SaveProjectDraftDto,
} from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import {
  toEditorValues,
  toSaveRequest,
  type GardenEditorValues,
} from "./editor-values";

export type DraftEditorAccess = {
  load: (options: RequestInit) => Promise<ProjectDto>;
  save: (
    input: SaveProjectDraftDto,
    options: RequestInit,
  ) => Promise<ProjectDto>;
  onProject: (project: ProjectDto) => void;
};

export function useDraftEditor(
  project: ProjectDto,
  access?: DraftEditorAccess,
) {
  const form = useForm<GardenEditorValues>({
    defaultValues: toEditorValues(project),
  });
  const action = useFormAction();
  const cache = useQueryClient();
  const revision = useRef(project.revision);
  const [status, setStatus] = useState<
    "initial" | "saved" | "loaded" | "conflict" | "locked"
  >("initial");
  const error =
    action.error instanceof ApiRequestError ? action.error : undefined;

  function applyServerProject(current: ProjectDto, source: "saved" | "loaded") {
    revision.current = current.revision;
    form.reset(toEditorValues(current));
    if (access) {
      access.onProject(current);
    } else {
      cache.setQueryData(getGetProjectQueryKey(project.id), current);
      void cache.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
    }
    setStatus(current.canEditDraft ? source : "locked");
  }

  const submit = form.handleSubmit(async (values) => {
    if (status === "conflict" || status === "locked") return;
    await action.run(
      async () => {
        setStatus("initial");
        try {
          const request = toSaveRequest(values, revision.current);
          const options = { signal: AbortSignal.timeout(15_000) };
          return await (access
            ? access.save(request, options)
            : saveProjectDraft(project.id, request, options));
        } catch (failure) {
          if (action.isActive() && failure instanceof ApiRequestError) {
            if (failure.code === "REVISION_CONFLICT") setStatus("conflict");
            if (failure.code === "CONTENT_LOCKED") setStatus("locked");
          }
          throw failure;
        }
      },
      (current) => applyServerProject(current, "saved"),
    );
  });

  function loadServerVersion() {
    return action.run(
      () => {
        const options = { signal: AbortSignal.timeout(10_000) };
        return access ? access.load(options) : getProject(project.id, options);
      },
      (current) => applyServerProject(current, "loaded"),
    );
  }

  return {
    form,
    submit,
    loadServerVersion,
    status,
    error,
    failed: action.error != null,
    busy: action.busy,
  };
}
