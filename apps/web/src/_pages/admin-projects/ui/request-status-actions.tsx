"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiRequestError,
  getGetAdminRequestQueryKey,
  getListAdminRequestsQueryKey,
  updateAdminRequestStatus,
  type AdminRequestDetailDto,
  type UpdateAdminRequestStatusDto,
} from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import { Alert, Button, Group, Stack, Text } from "@shared/ui";

export function RequestStatusActions({
  record,
  refresh,
}: {
  record: AdminRequestDetailDto;
  refresh: () => Promise<unknown>;
}) {
  const t = useTranslations("AdminRequests");
  const cache = useQueryClient();
  const [confirmReject, setConfirmReject] = useState(false);
  const action = useFormAction();
  const conflict =
    action.error instanceof ApiRequestError &&
    action.error.code === "REQUEST_STATE_CONFLICT";
  const [conflictVersion, setConflictVersion] = useState<number>();
  const requiresRefresh = conflict && conflictVersion === record.requestVersion;

  function update(status: UpdateAdminRequestStatusDto["status"]) {
    return action.run(
      async () => {
        setConflictVersion(record.requestVersion);
        return updateAdminRequestStatus(
          record.id,
          {
            status,
            expectedVersion: record.requestVersion,
          },
          { signal: AbortSignal.timeout(15_000) },
        );
      },
      (result) => {
        setConfirmReject(false);
        cache.setQueryData<AdminRequestDetailDto>(
          getGetAdminRequestQueryKey(record.id),
          (current) =>
            current && current.requestVersion <= result.requestVersion
              ? {
                  ...current,
                  status: result.status,
                  requestVersion: result.requestVersion,
                }
              : current,
        );
        void cache.invalidateQueries({
          queryKey: getListAdminRequestsQueryKey(),
        });
      },
    );
  }

  if (record.status !== "NEW" && record.status !== "IN_PROGRESS") return null;
  return (
    <Stack>
      {action.error != null && (
        <Alert role="alert" color="red">
          <Stack align="start">
            <Text>{t(conflict ? "statusConflict" : "statusFailure")}</Text>
            {requiresRefresh && (
              <Button variant="default" onClick={() => void refresh()}>
                {t("refreshStatus")}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      <Group>
        {record.status === "NEW" && (
          <Button
            autoContrast
            disabled={confirmReject || requiresRefresh}
            loading={action.busy}
            onClick={() => void update("IN_PROGRESS")}
          >
            {t("takeRequest")}
          </Button>
        )}
        {!confirmReject && (
          <Button
            color="red"
            variant="light"
            disabled={action.busy || requiresRefresh}
            onClick={() => setConfirmReject(true)}
          >
            {t("rejectRequest")}
          </Button>
        )}
      </Group>
      {confirmReject && (
        <Alert color="yellow">
          <Stack>
            <Text>{t("confirmReject")}</Text>
            <Group>
              <Button
                color="red"
                autoContrast
                loading={action.busy}
                disabled={requiresRefresh}
                onClick={() => void update("REJECTED")}
              >
                {t("confirmAction")}
              </Button>
              <Button
                variant="default"
                disabled={action.busy}
                onClick={() => setConfirmReject(false)}
              >
                {t("cancelAction")}
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
