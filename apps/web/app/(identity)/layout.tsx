import "@mantine/core/styles.css";
import { ColorSchemeScript } from "@mantine/core";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { IdentityProviders } from "@app/identity-providers";
import { parseLocale } from "@shared/config/locale";
export default async function IdentityLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = parseLocale(await getLocale());
  const {
    Common,
    Auth,
    Account,
    Identity,
    Projects,
    DraftEditor,
    DraftPhotos,
    ProjectPreview,
    Requests,
    AdminRequests,
    AdminPublish,
    AdminResume,
    AdminUnpublish,
    RsvpDashboard,
  } = await getMessages();
  return (
    <>
      <ColorSchemeScript defaultColorScheme="light" />
      <IdentityProviders
        locale={locale}
        messages={{
          Common,
          Auth,
          Account,
          Identity,
          Projects,
          DraftEditor,
          DraftPhotos,
          ProjectPreview,
          Requests,
          AdminRequests,
          AdminPublish,
          AdminResume,
          AdminUnpublish,
          RsvpDashboard,
        }}
      >
        {children}
      </IdentityProviders>
    </>
  );
}
