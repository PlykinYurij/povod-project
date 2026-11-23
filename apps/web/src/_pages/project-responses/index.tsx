import { getTranslations } from "next-intl/server";
import { Anchor, Stack, Title } from "@shared/ui";
import { IdentityShell } from "@widgets/identity-shell";
import { ResponsesSession } from "./ui/responses-session";

export async function ProjectResponsesPage({
  projectId,
}: {
  projectId: string;
}) {
  const t = await getTranslations("RsvpDashboard");
  return (
    <IdentityShell account>
      <Stack miw={0}>
        <Anchor href="/account">{t("account")}</Anchor>
        <Title order={1}>{t("heading")}</Title>
        <ResponsesSession projectId={projectId} />
      </Stack>
    </IdentityShell>
  );
}
