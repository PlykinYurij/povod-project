// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ApiRequestError, publishAdminRequest } from "@shared/api";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import ru from "@shared/i18n/ru.json";
import { PublishRequestForm } from "./publish-request-form";

vi.mock("@shared/api", async (load) => {
  const original = await load<typeof import("@shared/api")>();
  return { ...original, publishAdminRequest: vi.fn() };
});

const setup = setupIdentityTest();
const t = ru.AdminPublish;
const send = vi.mocked(publishAdminRequest);
const receipt = {
  publicationId: "0d17bd3d-52b8-4b77-b7e7-a6b319a2740b",
  snapshotId: "199bc5ad-e07f-45a8-8ea2-2e10a6999b1f",
  url: "https://happy-day.invite.example.test/",
  requestVersion: 2,
  publishedAt: "2026-11-22T00:00:00.000Z",
  expiresAt: "2027-02-20T00:00:00.000Z",
};

function show() {
  send.mockReset();
  const onPublished = vi.fn();
  setup.show(
    <PublishRequestForm
      requestId="request"
      approval={{
        expectedPriceVersion: 4,
        expectedProjectRevision: 2,
        expectedRequestVersion: 1,
      }}
      onPublished={onPublished}
      refresh={async () => undefined}
    />,
  );
  setup.fill(t.slug, "happy-day");
  return onPublished;
}

test("requires review and reuses the key when the network outcome is unknown", async () => {
  const onPublished = show();
  send
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(receipt);
  const button = screen.getByRole("button", { name: t.submit });
  fireEvent.click(button);
  await screen.findByText(t.confirmRequired);
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: t.confirm }));
  fireEvent.click(button);
  await screen.findByText(t.failed);
  expect(onPublished).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(onPublished).toHaveBeenCalledWith(receipt));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0][2]?.headers).toEqual(
    send.mock.calls[1][2]?.headers,
  );
});

test("shows slug conflict under the field and allows a different name", async () => {
  show();
  send.mockRejectedValueOnce(new ApiRequestError(409, "SLUG_TAKEN"));
  fireEvent.click(screen.getByRole("checkbox", { name: t.confirm }));
  fireEvent.click(screen.getByRole("button", { name: t.submit }));
  await screen.findByText(t.slugTaken);
  setup.fill(t.slug, "another-day");
  await waitFor(() => expect(screen.queryByText(t.slugTaken)).toBeNull());
});
