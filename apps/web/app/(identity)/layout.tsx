import "@mantine/core/styles.css";
import { ColorSchemeScript } from "@mantine/core";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { IdentityProviders } from "../../src/_app/identity-providers";
import { LOCALE_COOKIE, parseLocale } from "../../src/shared/config/locale";

export default async function IdentityLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const { Common, Auth, Account, Identity } = (
    await import(`../../src/shared/i18n/${locale}.json`)
  ).default;
  const messages = { Common, Auth, Account, Identity };
  return (
    <>
      <ColorSchemeScript defaultColorScheme="light" />
      <IdentityProviders locale={locale} messages={messages}>
        {children}
      </IdentityProviders>
    </>
  );
}
