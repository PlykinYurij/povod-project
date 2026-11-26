"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { SessionFailure, SessionLoading } from "@entities/identity";
import { PrivateGardenPreview } from "@widgets/private-garden-preview";
import {
  ApiRequestError,
  getGetAdminRequestQueryKey,
  getListAdminRequestsQueryKey,
  type AdminRequestDetailDto,
  type PublicationReceiptDto,
  useGetAdminRequest,
} from "@shared/api";
import { Alert, Stack, Text, Title } from "@shared/ui";
import styles from "./request-detail.module.css";
import { RequestStatusActions } from "./request-status-actions";
import { AssistedCreate } from "./assisted-create";
import { AssistedEditor } from "./assisted-editor";
import { AssistedResponses } from "./assisted-responses";
import { PublishRequestForm } from "@features/publish-request";
import { RequestPublication } from "./request-publication";

export function RequestDetail({ requestId }: { requestId: string }) {
  const t = useTranslations("AdminRequests");
  const publishText = useTranslations("AdminPublish");
  const locale = useLocale();
  const cache = useQueryClient();
  const panel = useRef<HTMLElement>(null);
  const request = useGetAdminRequest(requestId, {
    query: { retry: false, refetchOnMount: "always" },
  });
  useEffect(() => panel.current?.focus(), []);
  const record = request.data;
  const price = record?.quotedPrice;
  const priceText = price
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: price.currency,
      }).format(price.amountMinor / 100)
    : t("pricePending");
  const project = record?.project;

  function onPublished(receipt: PublicationReceiptDto) {
    cache.setQueryData<AdminRequestDetailDto>(
      getGetAdminRequestQueryKey(requestId),
      (current) =>
        current && current.requestVersion <= receipt.requestVersion
          ? {
              ...current,
              publication: receipt,
              status: "COMPLETED",
              requestVersion: receipt.requestVersion,
              project: current.project
                ? {
                    ...current.project,
                    canEditDraft: false,
                    firstPublishedAt: receipt.publishedAt,
                  }
                : null,
            }
          : current,
    );
    void cache.invalidateQueries({ queryKey: getListAdminRequestsQueryKey() });
    void request.refetch();
  }

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className={styles.panel}
      aria-labelledby="admin-request-title"
    >
      <Stack>
        <Title order={2} id="admin-request-title">
          {t("details")}
        </Title>
        {request.isPending && <SessionLoading />}
        {request.isError &&
          (request.error instanceof ApiRequestError &&
          request.error.status === 404 ? (
            <Alert role="alert">{t("missing")}</Alert>
          ) : (
            <SessionFailure retry={() => void request.refetch()} />
          ))}
        {request.isSuccess && record && (
          <>
            <dl className={styles.contacts}>
              <dt>{t("contactName")}</dt>
              <dd>{record.contactName}</dd>
              <dt>{t("phone")}</dt>
              <dd>{record.phone}</dd>
              <dt>{t(record.contactChannel)}</dt>
              <dd>{record.contactValue}</dd>
              <dt>{t("status")}</dt>
              <dd>{t(record.status)}</dd>
              {(record.kind === "PUBLICATION" || project) && (
                <>
                  <dt>{t("quote")}</dt>
                  <dd>{priceText}</dd>
                </>
              )}
            </dl>
            <RequestStatusActions
              record={record}
              refresh={() => request.refetch()}
            />
            {record.kind === "ASSISTANCE" &&
              !record.hasAccount &&
              !project &&
              (record.status === "NEW" || record.status === "IN_PROGRESS") && (
                <AssistedCreate
                  record={record}
                  refresh={async () => {
                    await request.refetch();
                    void cache.invalidateQueries({
                      queryKey: getListAdminRequestsQueryKey(),
                    });
                  }}
                />
              )}
            {record.kind === "ASSISTANCE" &&
              !record.hasAccount &&
              project &&
              ((project.templateVersionId === "wedding-garden-v1" &&
                "program" in project.content) ||
                (project.templateVersionId === "wedding-together-v1" &&
                  "photo" in project.content)) &&
              project.canEditDraft && (
                <AssistedEditor
                  key={project.id}
                  requestId={requestId}
                  project={project}
                />
              )}
            {project &&
            ((project.templateVersionId === "wedding-garden-v1" &&
              "program" in project.content) ||
              (project.templateVersionId === "wedding-together-v1" &&
                "photo" in project.content)) ? (
              <>
                <Title order={3}>{t("preview")}</Title>
                <Text>{t("revision", { current: project.revision })}</Text>
                {record.submittedRevision !== null && (
                  <Text>
                    {t("submittedRevision", {
                      submitted: record.submittedRevision,
                    })}
                  </Text>
                )}
                <PrivateGardenPreview
                  source={{ kind: "assisted", id: requestId }}
                  content={project.content}
                  rsvp={<p>{t("noGuestForm")}</p>}
                  idPrefix="admin-preview"
                />
                {record.publicationLifecycle && (
                  <RequestPublication
                    project={project}
                    lifecycle={record.publicationLifecycle}
                    receipt={record.publication}
                    refresh={async (throwOnError = false) => {
                      await request.refetch({ throwOnError });
                      void cache.invalidateQueries({
                        queryKey: getListAdminRequestsQueryKey(),
                      });
                    }}
                  />
                )}
                {record.publicationLifecycle &&
                  record.publicationLifecycle.status !== "EXPIRED" &&
                  record.kind === "ASSISTANCE" &&
                  !record.hasAccount && (
                    <AssistedResponses key={requestId} requestId={requestId} />
                  )}
                {project.canEditDraft &&
                  (record.status === "NEW" ||
                    record.status === "IN_PROGRESS") &&
                  (price ? (
                    <PublishRequestForm
                      requestId={requestId}
                      approval={{
                        expectedRequestVersion: record.requestVersion,
                        expectedProjectRevision: project.revision,
                        expectedPriceVersion: price.version,
                      }}
                      onPublished={onPublished}
                      refresh={() => request.refetch()}
                    />
                  ) : (
                    <Text>{publishText("pricePending")}</Text>
                  ))}
              </>
            ) : (
              <Text>{t(project ? "unsupported" : "noProject")}</Text>
            )}
          </>
        )}
      </Stack>
    </section>
  );
}
