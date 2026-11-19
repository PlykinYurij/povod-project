"use client";
import { useTranslations } from "next-intl";
import { Alert, Button, Text } from "@shared/ui";

export function LogoutStatus({
  failed,
  retry,
}: {
  failed: boolean;
  retry: () => void;
}) {
  const auth = useTranslations("Auth");
  const common = useTranslations("Common");
  if (!failed) return <Text role="status">{auth("loggingOut")}</Text>;
  return (
    <Alert color="red" role="alert">
      {auth("logoutFailed")}
      <Button onClick={retry} mt="md">
        {common("retry")}
      </Button>
    </Alert>
  );
}
