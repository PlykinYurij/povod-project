import type { Project } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { templateValidators } from "../templates/template-content";
import { ProjectDto, ProjectSummaryDto } from "./project.dto";

export function projectSummary(project: Project): ProjectSummaryDto {
  return {
    id: project.id,
    templateVersionId: project.templateVersionId,
    title: project.title,
    revision: project.revision,
    firstPublishedAt: project.firstPublishedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    canEditDraft: project.firstPublishedAt === null,
  };
}

export function projectResponse(project: Project): ProjectDto {
  try {
    const draft = templateValidators(project.templateVersionId).draft({
      templateVersionId: project.templateVersionId,
      title: project.title,
      content: project.content,
    });
    return { ...projectSummary(project), content: draft.content };
  } catch {
    // Corrupt persisted data is a service failure, not a validation error caused by this GET.
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Не удалось прочитать проект",
    );
  }
}
