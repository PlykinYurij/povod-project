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
} from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import {
  toEditorValues,
  toSaveRequest,
  type GardenEditorValues,
} from "./editor-values";

export function useDraftEditor(project: ProjectDto) {
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
    cache.setQueryData(getGetProjectQueryKey(project.id), current);
    void cache.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
    setStatus(current.canEditDraft ? source : "locked");
  }

  const submit = form.handleSubmit(async (values) => {
    if (status === "conflict" || status === "locked") return;
    await action.run(
      async () => {
        setStatus("initial");
        try {
          return await saveProjectDraft(
            project.id,
            toSaveRequest(values, revision.current),
            {
              signal: AbortSignal.timeout(15_000),
            },
          );
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
      () => getProject(project.id, { signal: AbortSignal.timeout(10_000) }),
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
