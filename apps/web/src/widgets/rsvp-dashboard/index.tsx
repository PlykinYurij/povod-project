"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ApiRequestError,
  getListAssistedResponsesQueryOptions,
  getListProjectResponsesQueryOptions,
  type RsvpDashboardRowDto,
} from "@shared/api";
import { Alert, Button, Group, NativeSelect, Stack, Text } from "@shared/ui";
import { ResponseTable } from "./ui/response-table";
import { ExportResponses } from "./ui/export-responses";
import { DeleteResponseConfirmation } from "./ui/delete-response-confirmation";
import type { ResponseScope } from "./model/response-scope";
import styles from "./rsvp-dashboard.module.css";

export function RsvpDashboard({ scope }: { scope: ResponseScope }) {
  const t = useTranslations("RsvpDashboard");
  const locale = useLocale();
  const [attendance, setAttendance] = useState<"yes" | "no" | "all">("all");
  const [selected, setSelected] = useState<RsvpDashboardRowDto | null>(null);
  const queryOptions =
    scope.kind === "owner"
      ? getListProjectResponsesQueryOptions
      : getListAssistedResponsesQueryOptions;
  const params = attendance === "all" ? undefined : { attendance };
  const responses = useQuery(
    queryOptions(scope.id, params, {
      query: {
        retry: false,
        gcTime: 0,
        refetchOnMount: "always",
      },
    }),
  );

  const counts = responses.data?.counts;
  const missing =
    responses.error instanceof ApiRequestError &&
    [401, 403, 404].includes(responses.error.status);
  return (
    <Stack aria-label={t("heading")}>
      <Group align="end">
        <NativeSelect
          label={t("filter")}
          value={attendance}
          disabled={selected !== null}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setAttendance(value === "yes" || value === "no" ? value : "all");
          }}
          data={[
            { value: "all", label: t("all") },
            { value: "yes", label: t("yes") },
            { value: "no", label: t("no") },
          ]}
        />
        <Button
          variant="default"
          loading={responses.isFetching}
          onClick={() => void responses.refetch()}
        >
          {t("refresh")}
        </Button>
      </Group>
      {responses.isPending && <Text role="status">{t("loading")}</Text>}
      {responses.isError && (
        <Alert color="red" role="alert">
          {t(missing ? "unavailable" : "error")}
        </Alert>
      )}
      {responses.isSuccess && counts && (
        <>
          <ExportResponses scope={scope} />
          <dl className={styles.counts} aria-label={t("totals")}>
            {(["total", "yes", "no", "companions"] as const).map((key) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{counts[key]}</dd>
              </div>
            ))}
          </dl>
          {responses.data.items.length === 0 ? (
            <Text role="status">
              {t(counts.total === 0 ? "empty" : "noMatches")}
            </Text>
          ) : (
            <ResponseTable
              items={responses.data.items}
              locale={locale}
              selectForDeletion={setSelected}
              canSelect={selected === null}
            />
          )}
        </>
      )}
      {selected && (
        <DeleteResponseConfirmation
          key={selected.id}
          scope={scope}
          row={selected}
          close={() => setSelected(null)}
          removed={() => responses.refetch()}
        />
      )}
    </Stack>
  );
}
