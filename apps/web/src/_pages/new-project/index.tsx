import { getLocale, getTranslations } from "next-intl/server";
import { loadCatalog } from "@entities/template/server";
import { parseLocale } from "@shared/config/locale";
import { newProjectHref } from "@shared/config/project-navigation";
import { IdentityShell } from "@widgets/identity-shell";
import { Anchor, Stack, Text, Title } from "@shared/ui";
import { NewProjectSession } from "./ui/new-project-session";

export async function NewProjectPage({
  templateVersionId,
}: {
  templateVersionId?: string;
}) {
  const t = await getTranslations("Projects");
  const catalog = templateVersionId
    ? await loadCatalog(parseLocale(await getLocale()))
    : undefined;
  const template =
    catalog?.kind === "ready"
      ? catalog.items.find(
          (item) => item.templateVersionId === templateVersionId,
        )
      : undefined;

  return (
    <IdentityShell account>
      <Stack>
        <Title order={1}>{t("create")}</Title>
        {template ? (
          <NewProjectSession
            templateVersionId={template.templateVersionId}
            templateTitle={template.title}
          />
        ) : (
          <Text role="alert">
            {t(
              catalog?.kind === "unavailable"
                ? "catalogError"
                : "templateUnavailable",
            )}
          </Text>
        )}
        {catalog?.kind === "unavailable" && templateVersionId && (
          <Anchor href={newProjectHref(templateVersionId)}>{t("retry")}</Anchor>
        )}
        <Anchor href="/templates">{t("catalog")}</Anchor>
      </Stack>
    </IdentityShell>
  );
}
