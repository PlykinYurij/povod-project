"use client";
import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { Locale } from "@shared/config/locale";
import { getQueryClient } from "./query-client";
import { identityTheme } from "./identity-theme";
export function IdentityProviders({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <QueryClientProvider client={getQueryClient()}>
        <MantineProvider defaultColorScheme="light" theme={identityTheme}>
          {children}
        </MantineProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
