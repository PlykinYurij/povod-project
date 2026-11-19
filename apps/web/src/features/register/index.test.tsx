// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import ru from "@shared/i18n/ru.json";
import { RegistrationForm } from "./index";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const harness = setupIdentityTest();
const { show, fill } = harness;
const calls: { path: string; body: Record<string, unknown> }[] = [];
let registerStatus = 202;
beforeEach(() => {
  calls.length = 0;
  registerStatus = 202;
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
      if (path.endsWith("/register")) {
        if (registerStatus === 409)
          return Response.json(
            { error: { code: "EMAIL_UNAVAILABLE" } },
            { status: 409 },
          );
        return Response.json(
          {
            registrationId: "d24398d2-409c-4d87-a614-04967b2d705e",
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
          { status: 202 },
        );
      }
      throw new Error("Unexpected API request in test: " + path);
    }),
  );
});
function fillRegistration(confirmation = "Abcdef1!") {
  fill(ru.Identity.userName, " Анна ");
  fill(ru.Auth.email, "OWNER@example.test");
  fill(ru.Identity.newPassword, "Abcdef1!");
  fill(ru.Identity.confirmPassword, confirmation);
}

test("signup uses inline field errors and never browser validation popups", async () => {
  const { container } = show(<RegistrationForm returnTo="/account" />);
  fill(ru.Auth.email, "test");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  expect(container.querySelector("form")?.noValidate).toBe(true);
  expect(screen.getByText(ru.Auth.emailInvalid)).toBeTruthy();
  expect(screen.getByText(ru.Identity.nameInvalid)).toBeTruthy();
  expect(screen.getByText(ru.Identity.passwordMismatch)).toBeTruthy();
  expect(calls).toEqual([]);
});

test("password checklist updates and a mismatch prevents registration", async () => {
  show(<RegistrationForm returnTo="/account" />);
  fillRegistration("Different1!");
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
  await waitFor(() =>
    expect(screen.getByText(ru.Identity.passwordMismatch)).toBeTruthy(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  expect(calls).toEqual([]);
  fill(ru.Identity.confirmPassword, "Abcdef1!");
  await waitFor(() =>
    expect(screen.queryByText(ru.Identity.passwordMismatch)).toBeNull(),
  );
  fill(ru.Identity.newPassword, "Abc def1!");
  await waitFor(() =>
    expect(
      screen.getByRole("listitem", {
        name: `${ru.Identity.rule_noSpaces}: ${ru.Identity.ruleMissing}`,
      }),
    ).toBeTruthy(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  expect(calls).toEqual([]);
});

test("valid signup sends userName and only API fields, then asks for email code", async () => {
  show(<RegistrationForm returnTo="/account" />);
  fillRegistration();
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  await screen.findByLabelText(ru.Identity.code, { exact: false });
  expect(calls.find((call) => call.path.endsWith("/register"))?.body).toEqual({
    email: "owner@example.test",
    userName: "Анна",
    password: "Abcdef1!",
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(
    screen.queryByLabelText(ru.Identity.newPassword, { exact: false }),
  ).toBeNull();
});

test("email conflict is shown under email without a duplicate alert", async () => {
  registerStatus = 409;
  show(<RegistrationForm returnTo="/account" />);
  fillRegistration();
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  await screen.findByText(ru.Identity.emailUnavailable);
  expect(
    screen
      .getByLabelText(ru.Auth.email, { exact: false })
      .getAttribute("aria-invalid"),
  ).toBe("true");
  expect(screen.queryByRole("alert")).toBeNull();
});
