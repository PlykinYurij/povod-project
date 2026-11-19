// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import ru from "@shared/i18n/ru.json";
import { PasswordResetForm } from "./index";

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
      if (path.endsWith("/password-reset/confirm"))
        return new Response(null, { status: 204 });
      if (path.endsWith("/password-reset/request"))
        return Response.json({ accepted: true }, { status: 202 });
      throw new Error("Unexpected API request in test: " + path);
    }),
  );
});
test("reset preserves leading-zero codes, excludes confirmation and maps password to API newPassword", async () => {
  show(<PasswordResetForm />);
  fill(ru.Auth.email, "owner@example.test");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.sendCode }),
  );
  await screen.findByLabelText(ru.Identity.code, { exact: false });
  fill(ru.Identity.code, "000123");
  fill(ru.Identity.newPassword, "Abcdef1!");
  fill(ru.Identity.confirmPassword, "Different1!");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.changePassword }),
  );
  expect(
    calls.some((call) => call.path.endsWith("/password-reset/confirm")),
  ).toBe(false);
  fill(ru.Identity.confirmPassword, "Abcdef1!");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.changePassword }),
  );
  await screen.findByText(ru.Identity.resetSuccess);
  expect(
    calls.find((call) => call.path.endsWith("/password-reset/confirm"))?.body,
  ).toEqual({
    email: "owner@example.test",
    code: "000123",
    newPassword: "Abcdef1!",
  });
  expect(router.replace).not.toHaveBeenCalled();
});

test("reset resend clears only the code and preserves local passwords", async () => {
  show(<PasswordResetForm />);
  fill(ru.Auth.email, "owner@example.test");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.sendCode }),
  );
  await screen.findByLabelText(ru.Identity.code, { exact: false });
  fill(ru.Identity.code, "000123");
  fill(ru.Identity.newPassword, "Abcdef1!");
  fill(ru.Identity.confirmPassword, "Abcdef1!");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.resend }),
  );
  await screen.findByText(ru.Identity.resetResent);
  expect(
    (
      screen.getByLabelText(ru.Identity.code, {
        exact: false,
      }) as HTMLInputElement
    ).value,
  ).toBe("");
  expect(
    (
      screen.getByLabelText(ru.Identity.newPassword, {
        exact: false,
      }) as HTMLInputElement
    ).value,
  ).toBe("Abcdef1!");
  expect(
    (
      screen.getByLabelText(ru.Identity.confirmPassword, {
        exact: false,
      }) as HTMLInputElement
    ).value,
  ).toBe("Abcdef1!");
});
