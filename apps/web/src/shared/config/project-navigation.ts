export const NEW_PROJECT_ROUTE = "/projects/new";

export function newProjectHref(templateVersionId: string): string {
  return `${NEW_PROJECT_ROUTE}?${new URLSearchParams({ templateVersionId })}`;
}
