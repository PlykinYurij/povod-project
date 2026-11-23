// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import ru from "@shared/i18n/ru.json";
import { RsvpDashboard } from "./index";

const setup = setupIdentityTest();
const t = ru.RsvpDashboard;
const projectId = "62654033-a24e-48c1-aec0-26122499f18a";
const counts = { total: 2, yes: 1, no: 1, companions: 2 };
const row = { id: projectId, receivedAt: "2026-11-23T12:00:00Z" };
const yes = { ...row, name: "Анна", attendance: "yes", companions: 2 };
const no = {
  ...row,
  id: "199bc5ad-e07f-45a8-8ea2-2e10a6999b1f",
  name: "Борис",
  attendance: "no",
  companions: 0,
};

test("filters the response list while preserving project totals", async () => {
  const fetchFake = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ counts, items: [yes, no] }))
    .mockResolvedValueOnce(Response.json({ counts, items: [yes] }));
  vi.stubGlobal("fetch", fetchFake);
  setup.show(<RsvpDashboard scope={{ kind: "owner", id: projectId }} />);
  await screen.findByText("Борис");
  fireEvent.change(screen.getByRole("combobox", { name: t.filter }), {
    target: { value: "yes" },
  });
  const table = await screen.findByRole("table");
  expect(within(table).queryByText("Борис")).toBeNull();
  expect(within(table).getByText("Анна")).toBeTruthy();
  expect(screen.getByText(t.total).nextElementSibling?.textContent).toBe("2");
  const [url, options] = fetchFake.mock.calls[1];
  expect(url).toContain(`/projects/${projectId}/responses?attendance=yes`);
  expect(options).toMatchObject({ credentials: "include", cache: "no-store" });
});

test("shows unavailable for private scope denied by the API", async () => {
  const fetchFake = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: { code: "RSVP_DASHBOARD_UNAVAILABLE" } },
        { status: 404 },
      ),
    );
  vi.stubGlobal("fetch", fetchFake);
  setup.show(<RsvpDashboard scope={{ kind: "assisted", id: projectId }} />);
  await screen.findByText(t.unavailable);
  expect(screen.queryByRole("table")).toBeNull();
  expect(fetchFake.mock.calls[0][0]).toContain(
    `/admin/requests/${projectId}/responses`,
  );
});
