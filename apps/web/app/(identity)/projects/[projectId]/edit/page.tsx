import { notFound } from "next/navigation";
import { ProjectEditorPage } from "@pages/project-editor";
import { isProjectId } from "@shared/config/project-navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isProjectId(projectId)) notFound();
  return <ProjectEditorPage projectId={projectId} />;
}
