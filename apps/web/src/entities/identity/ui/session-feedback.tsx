"use client";
import { useTranslations } from "next-intl";
import { Alert, Button, Group, Loader, Text } from "@shared/ui";

export function SessionLoading() {
  const t = useTranslations("Common");
  return (
    <Group role="status">
      <Loader size="sm" />
      <Text>{t("loading")}</Text>
    </Group>
  );
}

export function SessionFailure({ retry }: { retry: () => void }) {
  const t = useTranslations("Account");
  const common = useTranslations("Common");
  return (
    <Alert color="red" role="alert">
      {t("error")}
      <Button onClick={retry} mt="md">
        {common("retry")}
      </Button>
    </Alert>
  );
}
