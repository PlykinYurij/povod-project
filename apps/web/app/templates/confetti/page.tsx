import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ConfettiDemoPage, confettiDemoMessages } from "@pages/confetti-demo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "en" ? "en" : "ru";
  const messages = confettiDemoMessages[locale];
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
    <ConfettiDemoPage locale={locale === "en" ? "en" : "ru"} sample={sample} />
  );
}
