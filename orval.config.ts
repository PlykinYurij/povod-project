import { defineConfig } from "orval";

const output = {
  mode: "single" as const,
  schemas: "./packages/api-client/src/generated/models",
  override: {
    query: { version: 5 as const },
    mutator: {
      path: "./packages/api-client/src/transport.ts",
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
      target: "./packages/api-client/src/generated/http.ts",
    },
  },
  query: {
    input: "./apps/api/openapi.json",
    output: {
      ...output,
      client: "react-query",
      httpClient: "fetch",
      target: "./packages/api-client/src/generated/query.ts",
    },
  },
});
