import { getTranslations } from "next-intl/server";
import { IdentityShell } from "@widgets/identity-shell";
import { Title } from "@shared/ui";
import { LoginSession } from "./ui/login-session";
export async function LoginPage({ returnTo }: { returnTo: string }) {
  const t = await getTranslations("Auth");
  return (
    <IdentityShell>
      <Title order={1}>{t("title")}</Title>
      <LoginSession returnTo={returnTo} />
    </IdentityShell>
  );
}
