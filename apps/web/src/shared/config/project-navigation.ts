export const NEW_PROJECT_ROUTE = "/projects/new";

const PROJECT_ID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const projectIdPattern = new RegExp(`^${PROJECT_ID}$`);
const projectEditorPattern = new RegExp(`^/projects/${PROJECT_ID}/edit$`);

export function isProjectId(value: string): boolean {
  return projectIdPattern.test(value);
}

export function isProjectEditorPath(value: string): boolean {
  return projectEditorPattern.test(value);
}

export function projectEditorHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/edit`;
}

export function newProjectHref(templateVersionId: string): string {
  return `${NEW_PROJECT_ROUTE}?${new URLSearchParams({ templateVersionId })}`;
}
