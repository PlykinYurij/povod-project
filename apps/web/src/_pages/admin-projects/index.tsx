import { getTranslations } from "next-intl/server";
import { Anchor, Stack, Title } from "@shared/ui";
import { IdentityShell } from "@widgets/identity-shell";
import { AdminSession } from "./ui/admin-session";

export async function AdminProjectsPage() {
  const t = await getTranslations("AdminRequests");
  return (
    <IdentityShell account>
      <Stack>
        <Anchor href="/account">{t("account")}</Anchor>
        <Title order={1}>{t("heading")}</Title>
        <AdminSession />
      </Stack>
    </IdentityShell>
  );
}
