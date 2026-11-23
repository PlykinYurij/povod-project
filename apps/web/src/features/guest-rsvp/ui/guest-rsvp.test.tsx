// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ApiRequestError, submitPublicRsvp } from "@shared/api";
import { getGardenTranslations } from "@shared/i18n/garden";
import { GuestRsvp } from "./guest-rsvp";

vi.mock("@shared/api", async (load) => ({
  ...(await load<typeof import("@shared/api")>()),
  submitPublicRsvp: vi.fn(),
}));

const send = vi.mocked(submitPublicRsvp);
const t = getGardenTranslations("ru");
const formVersionId = "62654033-a24e-48c1-aec0-26122499f18a";
const receipt = {
  responseId: formVersionId,
  receivedAt: "2026-11-23T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  send.mockReset();
});

function show() {
  render(
    <GuestRsvp
      slug="party"
      locale="ru"
      schema={{
        formVersionId,
        nameMaxLength: 80,
        maxCompanions: 2,
        schema: "garden-v1",
      }}
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: " Анна " },
  });
}

function choose(label: "rsvpYes" | "rsvpNo") {
  fireEvent.click(screen.getByRole("radio", { name: t(label) }));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: t("rsvpSubmit") }));
}

test("declining clears companions and only a confirmed receipt displays success", async () => {
  show();
  send.mockResolvedValueOnce(receipt);
  choose("rsvpYes");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
  choose("rsvpNo");
  expect(screen.queryByRole("combobox")).toBeNull();
  submit();
  await screen.findByText(t("rsvpSuccess"));
  expect(send.mock.calls[0][1]).toEqual({
    formVersionId,
    name: "Анна",
    attendance: "no",
    companions: 0,
  });
});

test("retries a lost response with the same values and idempotency key", async () => {
  show();
  send
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(receipt);
  choose("rsvpYes");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
  submit();
  await screen.findByText(t("rsvpUncertain"));
  expect(screen.queryByText(t("rsvpSuccess"))).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: t("rsvpRetry") }));
  await screen.findByText(t("rsvpSuccess"));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);
  expect(send.mock.calls[0][2]?.headers).toEqual(
    send.mock.calls[1][2]?.headers,
  );
});

test.each([
  [409, "RSVP_LIMIT_REACHED", "rsvpLimit"],
  [404, "INVITATION_UNAVAILABLE", "rsvpUnavailable"],
  [409, "RSVP_FORM_CHANGED", "rsvpChanged"],
] as const)(
  "keeps failures visible for %s %s",
  async (status, code, message) => {
    show();
    send.mockRejectedValueOnce(new ApiRequestError(status, code));
    choose("rsvpYes");
    submit();
    await screen.findByText(t(message));
    await waitFor(() =>
      expect(screen.queryByText(t("rsvpSuccess"))).toBeNull(),
    );
  },
);
