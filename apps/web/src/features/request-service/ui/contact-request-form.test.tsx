// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { ApiRequestError, type ServiceRequestReceiptDto } from "@shared/api";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import type { SendContactRequest } from "../model/use-contact-request";
import { ContactRequestForm } from "./contact-request-form";

const { show, fill } = setupIdentityTest();
const t = ru.Requests;
const receipt: ServiceRequestReceiptDto = {
  requestId: "f729d400-0942-4633-9bc7-f33ffe78c422",
  status: "RECEIVED",
  createdAt: "2026-11-21T00:00:00.000Z",
};

async function enterContacts() {
  fill(t.name, "Анна");
  fill(t.phone, "+7 900 123-45-67");
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: t.channel }),
    "VK",
  );
  fill(t.contact.replace("{channel}", t.VK), "example");
}

test("requires consent, follows the chosen channel and confirms receipt", async () => {
  const send = vi.fn<SendContactRequest>().mockResolvedValue(receipt);
  show(<ContactRequestForm send={send} />);
  await enterContacts();
  await userEvent.click(screen.getByRole("button", { name: t.send }));
  expect(await screen.findByText(t.consentRequired)).toBeTruthy();
  expect(send).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("checkbox", { name: t.consent }));
  await userEvent.click(screen.getByRole("button", { name: t.send }));
  expect(await screen.findByText(t.received)).toBeTruthy();
  expect(send.mock.calls[0][0]).toMatchObject({
    contactChannel: "VK",
    contactValue: "example",
    privacyConsent: true,
  });
});

test("after a lost response, a refreshed quote does not change the retried request", async () => {
  const oldQuote = vi
    .fn<SendContactRequest>()
    .mockRejectedValueOnce(new ApiRequestError(503, "SERVICE_UNAVAILABLE"))
    .mockResolvedValueOnce(receipt);
  const newQuote = vi.fn<SendContactRequest>();
  const verify = vi.fn<() => Promise<void>>();
  function Scenario() {
    const [send, setSend] = useState<SendContactRequest>(() => oldQuote);
    return (
      <ContactRequestForm
        send={send}
        verify={async () => {
          await verify();
          setSend(() => newQuote);
        }}
      />
    );
  }
  show(<Scenario />);
  await enterContacts();
  await userEvent.click(screen.getByRole("checkbox", { name: t.consent }));
  await userEvent.click(screen.getByRole("button", { name: t.send }));
  expect(await screen.findByText(t.uncertain)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: t.refresh }));
  expect(verify).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: t.retry }));
  expect(await screen.findByText(t.received)).toBeTruthy();
  expect(newQuote).not.toHaveBeenCalled();
  expect(oldQuote.mock.calls[1][0]).toEqual(oldQuote.mock.calls[0][0]);
  expect(oldQuote.mock.calls[1][1].headers).toEqual(
    oldQuote.mock.calls[0][1].headers,
  );
});
