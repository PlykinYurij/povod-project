import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectResponsesPage } from "@pages/project-responses";
import { isProjectId } from "@shared/config/project-navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isProjectId(projectId)) notFound();
  return <ProjectResponsesPage projectId={projectId} />;
}
