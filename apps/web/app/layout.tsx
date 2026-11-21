import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "@shared/config/locale";
import { publicationSurface } from "@shared/config/publication-host";

export const metadata: Metadata = {
  title: "Повод — сайты-приглашения",
  description: "Сайты-приглашения для событий, которые хочется разделить.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const surface = publicationSurface((await headers()).get("host"));
  const locale =
    surface.kind === "guest"
      ? "ru"
      : parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
