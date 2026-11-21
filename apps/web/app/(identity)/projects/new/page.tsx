import { NewProjectPage } from "@pages/new-project";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ templateVersionId?: string | string[] }>;
}) {
  const { templateVersionId } = await searchParams;
  return (
    <NewProjectPage
      templateVersionId={
        typeof templateVersionId === "string" ? templateVersionId : undefined
      }
    />
  );
}
