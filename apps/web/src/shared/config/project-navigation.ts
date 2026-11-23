export const NEW_PROJECT_ROUTE = "/projects/new";

const PROJECT_ID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const projectIdPattern = new RegExp(`^${PROJECT_ID}$`);
const privateProjectPattern = new RegExp(
  `^/projects/${PROJECT_ID}/(?:edit|preview|responses)$`,
);

export function isProjectId(value: string): boolean {
  return projectIdPattern.test(value);
}

export function isPrivateProjectPath(value: string): boolean {
  return privateProjectPattern.test(value);
}

export function projectEditorHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/edit`;
}

export function projectPreviewHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/preview`;
}

export function projectResponsesHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/responses`;
}

export function newProjectHref(templateVersionId: string): string {
  return `${NEW_PROJECT_ROUTE}?${new URLSearchParams({ templateVersionId })}`;
}
