// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ApiRequestError, resumeAdminProject } from "@shared/api";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import { ResumeProjectAction } from "./resume-project-action";

vi.mock("@shared/api", async (load) => ({
  ...(await load<typeof import("@shared/api")>()),
  resumeAdminProject: vi.fn(),
}));

const setup = setupIdentityTest();
const t = ru.AdminResume;
const send = vi.mocked(resumeAdminProject);
const projectId = "0d17bd3d-52b8-4b77-b7e7-a6b319a2740b";
const receipt = {
  publicationId: projectId,
  publicationVersion: 4,
  status: "PUBLISHED",
  expiresAt: "2027-01-01T10:00:00.000Z",
  remainingMs: null,
} as const;

function show() {
  send.mockReset();
  const refresh = vi.fn().mockResolvedValue(undefined);
  setup.show(
    <ResumeProjectAction
      projectId={projectId}
      projectRevision={3}
      publicationVersion={2}
      refresh={refresh}
    />,
  );
  click(t.title);
  return refresh;
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

test("confirms the reviewed revision and repeats the same request after an uncertain result", async () => {
  const refresh = show();
  expect(send).not.toHaveBeenCalled();
  expect(
    screen.getByText(t.description.replace("{revision}", "3")),
  ).toBeTruthy();
  send.mockRejectedValueOnce(new TypeError()).mockResolvedValueOnce(receipt);
  click(t.confirm);
  fireEvent.click(await screen.findByRole("button", { name: t.retry }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(send.mock.calls[0][1]).toEqual({
    expectedProjectRevision: 3,
    expectedPublicationVersion: 2,
  });
  expect(send.mock.calls[1][1]).toEqual(send.mock.calls[0][1]);
  expect(send.mock.calls[1][2]?.headers).toEqual(
    send.mock.calls[0][2]?.headers,
  );
});

test.each([false, true])(
  "allows refresh without repeating the mutation when refresh fails=%s",
  async (refreshFails) => {
    const refresh = show();
    if (refreshFails) {
      send.mockResolvedValueOnce(receipt);
      refresh.mockRejectedValueOnce(new Error());
    } else {
      send.mockRejectedValueOnce(
        new ApiRequestError(409, "PUBLICATION_STATE_CONFLICT"),
      );
    }
    click(t.confirm);
    fireEvent.click(await screen.findByRole("button", { name: t.refresh }));
    await waitFor(() =>
      expect(refresh).toHaveBeenCalledTimes(refreshFails ? 2 : 1),
    );
    expect(send).toHaveBeenCalledTimes(1);
  },
);
