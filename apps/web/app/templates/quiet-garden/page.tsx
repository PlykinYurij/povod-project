import type { Metadata } from "next";
import { GardenDemoPage } from "@pages/garden-demo";

export const metadata: Metadata = {
  title: "Тихий сад — демо шаблона | Повод",
  description:
    "Демонстрация свадебного приглашения «Тихий сад». Синтетические данные, без публикации и приёма ответов.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    palette?: string | string[];
    sample?: string | string[];
  }>;
}) {
  const { palette, sample } = await searchParams;
  return <GardenDemoPage palette={palette} sample={sample} />;
}
