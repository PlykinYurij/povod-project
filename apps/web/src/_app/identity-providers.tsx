"use client";

import { useState, type ReactNode } from "react";
import { Button, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { Locale } from "../shared/config/locale";

export function IdentityProviders({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
}) {
  // A browser-scoped instance, never shared server state between owners.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 0 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <QueryClientProvider client={client}>
        <MantineProvider
          defaultColorScheme="light"
          theme={{
            colors: {
              povod: [
                "#f0f6f0",
                "#e3eee4",
                "#cee1cf",
                "#b0d6b7",
                "#85b993",
                "#639b76",
                "#467b59",
                "#315f4b",
                "#254b39",
                "#183426",
              ],
            },
            primaryColor: "povod",
            primaryShade: { light: 7, dark: 3 },
            autoContrast: true,
            components: {
              Button: Button.extend({
                styles: {
                  root: { minHeight: "var(--identity-control-height, 46px)" },
                },
              }),
            },
            defaultRadius: "md",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {children}
        </MantineProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
