import { isTemplateCatalog } from "./catalog-validation";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields: readonly { path: string; code: string }[] = [],
    readonly retryAfter?: number,
  ) {
    super(code);
    this.name = "ApiRequestError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function apiOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:3001";
  const url = new URL(origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== origin ||
    url.username ||
    url.password
  )
    throw new Error(
      "NEXT_PUBLIC_API_ORIGIN must be an exact trusted HTTP(S) origin",
    );
  return origin;
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  return response.json().catch(() => undefined);
}

export function responseError(
  response: Response,
  body: unknown,
): ApiRequestError {
  const details = isObject(body) && isObject(body.error) ? body.error : {};
  const code =
    typeof details.code === "string" ? details.code : "SERVICE_UNAVAILABLE";
  const fields = Array.isArray(details.fields)
    ? details.fields.filter(
        (field): field is { path: string; code: string } =>
          isObject(field) &&
          typeof field.path === "string" &&
          typeof field.code === "string",
      )
    : [];
  const retry = Number(response.headers.get("Retry-After"));
  return new ApiRequestError(
    response.status,
    code,
    fields,
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}

let browserBootstrap: Promise<string> | undefined;
async function browserCsrf(): Promise<string> {
  // Share only an in-flight browser bootstrap; never a server request's cookies/token.
  if (!browserBootstrap)
    browserBootstrap = (async () => {
      const response = await fetch(`${apiOrigin()}/api/v1/auth/csrf`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await readJson(response);
      if (!response.ok) throw responseError(response, body);
      if (!isObject(body) || typeof body.csrfToken !== "string")
        throw new ApiRequestError(503, "SERVICE_UNAVAILABLE");
      return body.csrfToken;
    })();
  try {
    return await browserBootstrap;
  } finally {
    browserBootstrap = undefined;
  }
}

function allowedProjectMethods(path: string): readonly string[] | undefined {
  if (path === "/api/v1/projects") return ["GET", "POST"];
  const resource =
    /^\/api\/v1\/projects\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\/draft)?$/i.exec(
      path,
    );
  if (!resource) return undefined;
  return resource[1] ? ["PATCH"] : ["GET"];
}

/** Orval fetch mutator. Only fixed API paths can receive credentials. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const publicCatalog = /^\/api\/v1\/templates(?:\?locale=(?:ru|en))?$/.test(
    path,
  );
  const projectMethods = allowedProjectMethods(path);
  if (
    (!path.startsWith("/api/v1/auth/") &&
      path !== "/health" &&
      !publicCatalog &&
      !projectMethods) ||
    path.includes("..") ||
    path.includes("\\")
  )
    throw new Error("Untrusted API path");
  const method = (options.method ?? "GET").toUpperCase();
  if (projectMethods && !projectMethods.includes(method))
    throw new Error("Unsupported project method");
  const headers = new Headers(options.headers);
  if (publicCatalog) {
    if (options.method && options.method.toUpperCase() !== "GET")
      throw new Error("Public catalog is read-only");
    headers.delete("Cookie");
    headers.delete("Authorization");
    headers.delete("X-CSRF-Token");
  }
  const mutation =
    !!options.method && !["GET", "HEAD"].includes(options.method.toUpperCase());
  if (mutation && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (
    options.method &&
    !["GET", "HEAD"].includes(options.method.toUpperCase()) &&
    !headers.has("X-CSRF-Token")
  ) {
    if (typeof window === "undefined")
      throw new Error(
        "Server mutations require explicit request-scoped CSRF context",
      );
    headers.set("X-CSRF-Token", await browserCsrf());
  }
  const response = await fetch(apiOrigin() + path, {
    ...options,
    headers,
    body: mutation && options.body === undefined ? "{}" : options.body,
    credentials: publicCatalog ? "omit" : "include",
    cache: "no-store",
  });
  const body = await readJson(response);
  if (!response.ok) throw responseError(response, body);
  if (publicCatalog && !isTemplateCatalog(body))
    throw new ApiRequestError(503, "SERVICE_UNAVAILABLE");
  if (response.status !== 204 && body === undefined)
    throw new ApiRequestError(503, "SERVICE_UNAVAILABLE");
  if (
    [
      "/api/v1/auth/session",
      "/api/v1/auth/login",
      "/api/v1/auth/register/confirm",
    ].includes(path) &&
    (!isObject(body) ||
      !isObject(body.user) ||
      typeof body.user.id !== "string" ||
      typeof body.user.email !== "string" ||
      (body.user.userName !== null && typeof body.user.userName !== "string"))
  )
    throw new ApiRequestError(503, "SERVICE_UNAVAILABLE");
  if (
    ["/api/v1/auth/register", "/api/v1/auth/register/resend"].includes(path) &&
    (!isObject(body) ||
      typeof body.registrationId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        body.registrationId,
      ) ||
      typeof body.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(body.expiresAt)))
  )
    throw new ApiRequestError(503, "SERVICE_UNAVAILABLE");
  // Success shape is generated from the server-owned OpenAPI contract.
  return body as T;
}

export type ErrorType<_Error> = ApiRequestError;
