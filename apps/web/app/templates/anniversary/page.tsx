import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import {
  AnniversaryDemoPage,
  anniversaryDemoMessages,
} from "@pages/anniversary-demo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "en" ? "en" : "ru";
  const messages = anniversaryDemoMessages[locale];
  return {
    title: messages.title,
    description: messages.notice,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string | string[] }>;
}) {
  const [{ sample }, locale] = await Promise.all([searchParams, getLocale()]);
  return (
    <AnniversaryDemoPage
      locale={locale === "en" ? "en" : "ru"}
      sample={sample}
    />
  );
}
