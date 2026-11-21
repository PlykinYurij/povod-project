import { getTranslations } from "next-intl/server";
import { Anchor, Stack, Title } from "@shared/ui";
import { IdentityShell } from "@widgets/identity-shell";
import { PreviewSession } from "./ui/preview-session";

export async function ProjectPreviewPage({ projectId }: { projectId: string }) {
  const t = await getTranslations("ProjectPreview");
  return (
    <IdentityShell account>
      <Stack>
        <Anchor href="/account">{t("account")}</Anchor>
        <Title order={1}>{t("heading")}</Title>
        <PreviewSession key={projectId} projectId={projectId} />
      </Stack>
    </IdentityShell>
  );
}
