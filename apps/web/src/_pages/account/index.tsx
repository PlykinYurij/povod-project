import { getTranslations } from "next-intl/server";
import { IdentityShell } from "@widgets/identity-shell";
import { Title } from "@shared/ui";
import { AccountSession } from "./ui/account-session";
export async function AccountPage() {
  const t = await getTranslations("Account");
  return (
    <IdentityShell account>
      <Title order={1} mb="lg">
        {t("title")}
      </Title>
      <AccountSession />
    </IdentityShell>
  );
}
