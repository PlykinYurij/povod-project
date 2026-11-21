import { getTranslations } from "next-intl/server";
import { Anchor, Stack, Title } from "@shared/ui";
import { IdentityShell } from "@widgets/identity-shell";
import { EditorSession } from "./ui/editor-session";

export async function ProjectEditorPage({ projectId }: { projectId: string }) {
  const t = await getTranslations("DraftEditor");
  return (
    <IdentityShell account>
      <Stack>
        <Anchor href="/account">{t("account")}</Anchor>
        <Title order={1}>{t("heading")}</Title>
        <EditorSession key={projectId} projectId={projectId} />
      </Stack>
    </IdentityShell>
  );
}
