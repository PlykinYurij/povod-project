import { useTranslations } from "next-intl";
import {
  deleteAssistedResponse,
  deleteProjectResponse,
  type RsvpDashboardRowDto,
} from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import { Alert, Button, Group, Stack, Text } from "@shared/ui";
import type { ResponseScope } from "../model/response-scope";

export function DeleteResponseConfirmation({
  scope,
  row,
  close,
  removed,
}: {
  scope: ResponseScope;
  row: RsvpDashboardRowDto;
  close: () => void;
  removed: () => Promise<unknown>;
}) {
  const t = useTranslations("RsvpDashboard");
  const action = useFormAction();

  function confirm() {
    const request =
      scope.kind === "owner" ? deleteProjectResponse : deleteAssistedResponse;
    return action.run(
      () => request(scope.id, row.id, { signal: AbortSignal.timeout(15_000) }),
      async () => {
        await removed();
        close();
      },
    );
  }

  return (
    <Stack role="group" aria-label={t("deleteConfirmation")}>
      <Text>{t("deletePrompt", { name: row.name })}</Text>
      {action.error != null && (
        <Alert color="red" role="alert">
          {t("deleteFailed")}
        </Alert>
      )}
      <Group>
        <Button
          autoFocus
          variant="default"
          disabled={action.busy}
          onClick={close}
        >
          {t("cancelDelete")}
        </Button>
        <Button
          color="red"
          loading={action.busy}
          onClick={() => void confirm()}
        >
          {t("confirmDelete")}
        </Button>
      </Group>
    </Stack>
  );
}
