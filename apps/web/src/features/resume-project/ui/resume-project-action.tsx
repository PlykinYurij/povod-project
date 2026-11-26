"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiRequestError, resumeAdminProject } from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import { Alert, Button, Modal, Stack, Text } from "@shared/ui";

export function ResumeProjectAction({
  projectId,
  projectRevision,
  publicationVersion,
  refresh,
}: {
  projectId: string;
  projectRevision: number;
  publicationVersion: number;
  refresh: () => Promise<unknown>;
}) {
  const t = useTranslations("AdminResume");
  const [opened, setOpened] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const key = useRef<string>(null);
  const action = useFormAction();
  const status =
    action.error instanceof ApiRequestError ? action.error.status : undefined;
  const forbidden = status === 401 || status === 403 || status === 404;
  const stale = status === 409;
  const uncertain =
    !!action.error && (status === undefined || status >= 500 || status === 408);
  const busy = action.busy || refreshing;
  const refreshOnly = stale || refreshFailed;
  const message = refreshFailed
    ? "refreshFailed"
    : forbidden
      ? "forbidden"
      : stale
        ? "stale"
        : uncertain
          ? "uncertain"
          : action.error
            ? "failed"
            : undefined;

  async function reload() {
    setRefreshing(true);
    try {
      await refresh();
      if (action.isActive()) {
        setRefreshFailed(false);
        setOpened(false);
      }
    } catch {
      if (action.isActive()) setRefreshFailed(true);
    } finally {
      if (action.isActive()) setRefreshing(false);
    }
  }

  function send() {
    return action.run(() => {
      if (!uncertain || key.current === null) key.current = crypto.randomUUID();
      return resumeAdminProject(
        projectId,
        {
          expectedProjectRevision: projectRevision,
          expectedPublicationVersion: publicationVersion,
        },
        {
          headers: { "Idempotency-Key": key.current },
          signal: AbortSignal.timeout(15_000),
        },
      );
    }, reload);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpened(true)}
        disabled={forbidden}
        w="fit-content"
      >
        {t("title")}
      </Button>
      {forbidden && !opened && <Alert role="alert">{t("forbidden")}</Alert>}
      <Modal
        opened={opened}
        onClose={() => {
          if (!busy) setOpened(false);
        }}
        title={t("title")}
        centered
        closeOnEscape={!busy}
        closeOnClickOutside={false}
        withCloseButton={!busy}
      >
        <Stack>
          <Text>{t("description", { revision: projectRevision })}</Text>
          {busy && <Text role="status">{t("working")}</Text>}
          {message && (
            <Alert color="red" role="alert">
              {t(message)}
            </Alert>
          )}
          {refreshOnly ? (
            <Button disabled={busy} onClick={() => void reload()}>
              {t("refresh")}
            </Button>
          ) : (
            !forbidden && (
              <Button
                disabled={busy || action.remaining > 0}
                onClick={() => void send()}
              >
                {t(uncertain ? "retry" : "confirm")}
              </Button>
            )
          )}
          <Button
            data-autofocus
            variant="default"
            disabled={busy}
            onClick={() => setOpened(false)}
          >
            {t("close")}
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
