import { useTranslations } from "next-intl";
import { exportAssistedResponses, exportProjectResponses } from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import { Alert, Button, Stack } from "@shared/ui";
import type { ResponseScope } from "../model/response-scope";

export function ExportResponses({ scope }: { scope: ResponseScope }) {
  const t = useTranslations("RsvpDashboard");
  const action = useFormAction();

  function download() {
    const request =
      scope.kind === "owner" ? exportProjectResponses : exportAssistedResponses;
    return action.run(
      () => request(scope.id, { signal: AbortSignal.timeout(15_000) }),
      (workbook) => {
        const url = URL.createObjectURL(workbook);
        const link = document.createElement("a");
        link.href = url;
        link.download = "rsvp-responses.xlsx";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
    );
  }

  return (
    <Stack align="start" gap="xs">
      <Button
        variant="light"
        loading={action.busy}
        onClick={() => void download()}
      >
        {t("export")}
      </Button>
      {action.error != null && (
        <Alert color="red" role="alert">
          {t("exportFailed")}
        </Alert>
      )}
    </Stack>
  );
}
