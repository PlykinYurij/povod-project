import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { publicationSurface } from "@shared/config/publication-host";
import { getGardenTranslations } from "@shared/i18n/garden";

export default async function NotFound() {
  if (publicationSurface((await headers()).get("host")).kind === "guest") {
    return (
      <main>
        <h1>{getGardenTranslations("ru")("invitationUnavailable")}</h1>
      </main>
    );
  }
  const t = await getTranslations("Common");
  return (
    <main>
      <h1>{t("notFound")}</h1>
    </main>
  );
}
