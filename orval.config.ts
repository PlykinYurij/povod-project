import { defineConfig } from "orval";

const output = {
  mode: "single" as const,
  schemas: "./apps/web/src/shared/api/generated/models",
  override: {
    query: { version: 5 as const },
    mutator: {
      path: "./apps/web/src/shared/api/transport.ts",
      name: "apiFetch",
    },
    fetch: { includeHttpResponseReturnType: false },
  },
};
export default defineConfig({
  http: {
    input: "./apps/api/openapi.json",
    output: {
      ...output,
      client: "fetch",
      target: "./apps/web/src/shared/api/generated/http.ts",
    },
  },
  query: {
    input: "./apps/api/openapi.json",
    output: {
      ...output,
      client: "react-query",
      httpClient: "fetch",
      target: "./apps/web/src/shared/api/generated/query.ts",
    },
  },
});
