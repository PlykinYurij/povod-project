"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SessionFailure, SessionLoading } from "@entities/identity";
import { GardenInvitation } from "@entities/invitation";
import { ApiRequestError, useGetAdminRequest } from "@shared/api";
import { Alert, Stack, Text, Title } from "@shared/ui";
import styles from "./request-detail.module.css";

export function RequestDetail({ requestId }: { requestId: string }) {
  const t = useTranslations("AdminRequests");
  const locale = useLocale();
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
              {record.kind === "PUBLICATION" && (
                <>
                  <dt>{t("quote")}</dt>
                  <dd>{priceText}</dd>
                </>
              )}
            </dl>
            {project?.templateVersionId === "wedding-garden-v1" ? (
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
                <GardenInvitation
                  content={project.content}
                  rsvp={<p>{t("noGuestForm")}</p>}
                  idPrefix="admin-preview"
                />
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
