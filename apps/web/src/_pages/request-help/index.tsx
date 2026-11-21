import { getTranslations } from "next-intl/server";
import { PublicRequestForm } from "@features/request-service";
import { Anchor, Stack, Text, Title } from "@shared/ui";
import { IdentityShell } from "@widgets/identity-shell";

export async function RequestHelpPage() {
  const t = await getTranslations("Requests");
  return (
    <IdentityShell account>
      <Stack>
        <Anchor href="/">{t("home")}</Anchor>
        <Title order={1}>{t("publicTitle")}</Title>
        <Text>{t("publicIntro")}</Text>
        <PublicRequestForm />
      </Stack>
    </IdentityShell>
  );
}
