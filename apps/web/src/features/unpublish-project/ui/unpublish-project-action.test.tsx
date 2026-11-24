// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ApiRequestError, unpublishAdminProject } from "@shared/api";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import { UnpublishProjectAction } from "./unpublish-project-action";

vi.mock("@shared/api", async (load) => {
  const original = await load<typeof import("@shared/api")>();
  return { ...original, unpublishAdminProject: vi.fn() };
});

const setup = setupIdentityTest();
const t = ru.AdminUnpublish;
const send = vi.mocked(unpublishAdminProject);
const projectId = "0d17bd3d-52b8-4b77-b7e7-a6b319a2740b";

function show() {
  send.mockReset();
  const refresh = vi.fn().mockResolvedValue(undefined);
  setup.show(
    <UnpublishProjectAction
      projectId={projectId}
      projectRevision={3}
      publicationVersion={1}
      refresh={refresh}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: t.title }));
  return refresh;
}

function fill() {
  fireEvent.change(screen.getByLabelText(t.mode), {
    target: { value: "PAUSE_PERIOD" },
  });
  fireEvent.change(screen.getByLabelText(t.reason), {
    target: { value: "  Запрос владельца  " },
  });
}

function confirm() {
  fireEvent.click(screen.getByRole("button", { name: t.confirm }));
}

test("requires an explicit mode and reason, and retries the immutable attempt after a lost response", async () => {
  const refresh = show();
  confirm();
  await screen.findByText(t.modeRequired);
  expect(screen.getByText(t.reasonInvalid)).toBeTruthy();
  expect(send).not.toHaveBeenCalled();
  fill();
  send.mockRejectedValueOnce(new TypeError("Network"));
  send.mockResolvedValueOnce({
    publicationId: projectId,
    publicationVersion: 2,
    status: "PAUSED",
    expiresAt: null,
    remainingMs: 1000,
  });
  confirm();
  await screen.findByText(t.uncertain);
  expect(send).toHaveBeenCalledWith(
    projectId,
    {
      expectedProjectRevision: 3,
      expectedPublicationVersion: 1,
      mode: "PAUSE_PERIOD",
      reason: "Запрос владельца",
    },
    expect.objectContaining({ headers: expect.any(Object) }),
  );
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: t.retry }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);
  expect(send.mock.calls[0][2]?.headers).toEqual(
    send.mock.calls[1][2]?.headers,
  );
});

test("refreshes on a definite conflict without resending", async () => {
  const refresh = show();
  fill();
  send.mockRejectedValueOnce(
    new ApiRequestError(409, "PUBLICATION_STATE_CONFLICT"),
  );
  confirm();
  await screen.findByText(t.stale);
  expect(screen.queryByRole("button", { name: t.retry })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: t.refresh }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(send).toHaveBeenCalledOnce();
});

test("a forbidden response disables confirmation, retry and reopening", async () => {
  const refresh = show();
  fill();
  send.mockRejectedValueOnce(new ApiRequestError(403, "FORBIDDEN"));
  confirm();
  await screen.findByText(t.forbidden);
  expect(screen.queryByRole("button", { name: t.confirm })).toBeNull();
  expect(screen.queryByRole("button", { name: t.retry })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: t.close }));
  const trigger = await screen.findByRole("button", { name: t.title });
  expect(trigger.hasAttribute("disabled")).toBe(true);
  expect(refresh).not.toHaveBeenCalled();
});
