import type { Project } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { canEditProject, type PublicationLifecycle } from "../publication/publication-lifecycle";
import { templateValidators } from "../templates/template-content";
import { ProjectDto, ProjectSummaryDto } from "./project.dto";

export type ProjectWithPublication = Project & { publication?: PublicationLifecycle | null };

export function projectSummary(project: ProjectWithPublication): ProjectSummaryDto {
  return {
    id: project.id,
    templateVersionId: project.templateVersionId,
    title: project.title,
    revision: project.revision,
    firstPublishedAt: project.firstPublishedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    canEditDraft: canEditProject(project, new Date()),
  };
}

export function projectResponse(project: ProjectWithPublication): ProjectDto {
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
