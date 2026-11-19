import { afterEach, beforeAll, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import ru from "@shared/i18n/ru.json";

/** Test-only provider lifecycle; API responses belong to each colocated suite. */
export function setupIdentityTest() {
  let client: QueryClient;
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      })),
    });
  });
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false, gcTime: 0 },
      },
    });
  });
  afterEach(() => {
    cleanup();
    client.clear();
    vi.unstubAllGlobals();
  });
  return {
    get client() {
      return client;
    },
    show(children: ReactNode) {
      return render(
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="ru" messages={ru} timeZone="UTC">
            <MantineProvider env="test">{children}</MantineProvider>
          </NextIntlClientProvider>
        </QueryClientProvider>,
      );
    },
    fill(label: string, value: string) {
      fireEvent.change(
        screen.getByLabelText(label, { exact: false, selector: "input" }),
        { target: { value } },
      );
    },
  };
}
