import { isPrivateProjectPath, NEW_PROJECT_ROUTE } from "./project-navigation";

export const ACCOUNT_ROUTE = "/account";
export const LOGIN_ROUTE = "/login";

const INTERNAL_ORIGIN = "https://povod.invalid";
// Extend explicitly when another private route is implemented, not from user input.
const PRIVATE_ROUTES = new Set([ACCOUNT_ROUTE, NEW_PROJECT_ROUTE]);

export function safeReturnTo(value?: string | string[] | null): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return ACCOUNT_ROUTE;
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (
      url.origin !== INTERNAL_ORIGIN ||
      (!PRIVATE_ROUTES.has(url.pathname) && !isPrivateProjectPath(url.pathname))
    )
      return ACCOUNT_ROUTE;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return ACCOUNT_ROUTE;
  }
}

export function loginHref(returnTo: string): string {
  return `${LOGIN_ROUTE}?${new URLSearchParams({ returnTo: safeReturnTo(returnTo) })}`;
}
