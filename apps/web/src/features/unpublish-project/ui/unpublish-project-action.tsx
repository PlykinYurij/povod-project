"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import {
  ApiRequestError,
  unpublishAdminProject,
  type UnpublishProjectDto,
} from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import {
  Alert,
  Button,
  Modal,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from "@shared/ui";

type Fields = { mode: string; reason: string };
type Attempt = { key: string; payload: UnpublishProjectDto };

export function UnpublishProjectAction({
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
  const t = useTranslations("AdminUnpublish");
  const [opened, setOpened] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const attempt = useRef<Attempt>(null);
  const form = useForm<Fields>({ defaultValues: { mode: "", reason: "" } });
  const action = useFormAction();
  const error =
    action.error instanceof ApiRequestError ? action.error : undefined;
  const forbidden =
    error?.status === 401 || error?.status === 403 || error?.status === 404;
  const stale = error?.status === 409;
  const uncertain =
    !!action.error && (!error || error.status >= 500 || error.status === 408);
  const fieldRejected = !!error?.fields.some(({ path }) => path === "reason");
  const busy = action.busy || refreshing;

  function send(next: Attempt) {
    return action.run(
      () => {
        attempt.current = next;
        return unpublishAdminProject(projectId, next.payload, {
          headers: { "Idempotency-Key": next.key },
          signal: AbortSignal.timeout(15_000),
        });
      },
      async () => {
        await refresh();
        if (action.isActive()) setOpened(false);
      },
    );
  }

  const submit = form.handleSubmit(({ mode, reason }) => {
    if (busy || uncertain || stale || forbidden) return;
    if (mode !== "PAUSE_PERIOD" && mode !== "KEEP_RUNNING") return;
    const next: Attempt = {
      key: crypto.randomUUID(),
      payload: {
        mode,
        reason: reason.trim(),
        expectedProjectRevision: projectRevision,
        expectedPublicationVersion: publicationVersion,
      },
    };
    return send(next);
  });

  async function refreshAfterConflict() {
    setRefreshing(true);
    try {
      await refresh();
      if (action.isActive()) setOpened(false);
    } finally {
      if (action.isActive()) setRefreshing(false);
    }
  }

  const errorMessage = forbidden
    ? "forbidden"
    : stale
      ? "stale"
      : uncertain
        ? "uncertain"
        : action.error && !fieldRejected
          ? "failed"
          : undefined;

  return (
    <>
      <Button
        color="red"
        variant="outline"
        onClick={() => setOpened(true)}
        disabled={forbidden || stale}
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
        <form noValidate onSubmit={submit}>
          <Stack>
            <Text>{t("description")}</Text>
            <NativeSelect
              data-autofocus
              label={t("mode")}
              data={[
                { value: "", label: t("choose") },
                { value: "PAUSE_PERIOD", label: t("pause") },
                { value: "KEEP_RUNNING", label: t("keepRunning") },
              ]}
              disabled={busy || uncertain || stale || forbidden}
              error={form.formState.errors.mode?.message}
              {...form.register("mode", { required: t("modeRequired") })}
            />
            <Textarea
              label={t("reason")}
              description={t("reasonHint")}
              readOnly={busy || uncertain || stale || forbidden}
              error={
                form.formState.errors.reason?.message ??
                (fieldRejected ? t("reasonInvalid") : undefined)
              }
              {...form.register("reason", {
                validate: (value) => {
                  const reason = value.trim();
                  return (
                    ([...reason].length >= 1 &&
                      [...reason].length <= 240 &&
                      !/[\p{Cc}\p{Cs}]/u.test(reason)) ||
                    t("reasonInvalid")
                  );
                },
              })}
            />
            {busy && <Text role="status">{t("working")}</Text>}
            {errorMessage && (
              <Alert color="red" role="alert">
                {t(errorMessage)}
              </Alert>
            )}
            {stale && (
              <Button
                type="button"
                loading={refreshing}
                onClick={() => void refreshAfterConflict()}
              >
                {t("refresh")}
              </Button>
            )}
            {uncertain && (
              <Button
                type="button"
                loading={action.busy}
                onClick={() => {
                  if (attempt.current) void send(attempt.current);
                }}
              >
                {t("retry")}
              </Button>
            )}
            {!stale && !uncertain && !forbidden && (
              <Button type="submit" color="red" loading={action.busy}>
                {t("confirm")}
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              disabled={busy}
              onClick={() => setOpened(false)}
            >
              {t("close")}
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
