// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import ru from "@shared/i18n/ru.json";
import { SignInForm } from "./index";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const harness = setupIdentityTest();
const { show, fill } = harness;
const calls: { path: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  calls.length = 0;
  router.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url).pathname;
      const body: Record<string, unknown> = options?.body
        ? JSON.parse(String(options.body))
        : {};
      calls.push({ path, body });
      if (path.endsWith("/csrf"))
        return Response.json({ csrfToken: "synthetic" });
      if (path.endsWith("/login"))
        return Response.json({
          user: {
            id: "synthetic",
            email: "owner@example.test",
            userName: "Анна",
          },
        });
      throw new Error("Unexpected API request in test: " + path);
    }),
  );
});
test("login keeps a legacy password with spaces unchanged", async () => {
  show(<SignInForm returnTo="/account" />);
  fill(ru.Auth.email, "OWNER@example.test");
  fill(ru.Auth.password, " Old password1! ");
  await userEvent.click(screen.getByRole("button", { name: ru.Auth.submit }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
  expect(calls.find((call) => call.path.endsWith("/login"))?.body).toEqual({
    email: "owner@example.test",
    password: " Old password1! ",
  });
});
