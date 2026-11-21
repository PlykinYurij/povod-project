"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  createPublicationRequest,
  useGetProjectPublicationRequest,
  type TemplatePriceDto,
} from "@shared/api";
import { Alert, Button, Stack, Text, Title } from "@shared/ui";
import { ContactRequestForm } from "./contact-request-form";

function formattedPrice(price: TemplatePriceDto, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency,
  }).format(price.amountMinor / 100);
}

export function PublicationRequestPanel({
  projectId,
  revision,
  reloadProject,
  projectUnavailable,
}: {
  projectId: string;
  revision: number;
  reloadProject: () => Promise<void>;
  projectUnavailable: boolean;
}) {
  const t = useTranslations("Requests");
  const locale = useLocale();
  const state = useGetProjectPublicationRequest(projectId, {
    query: {
      retry: false,
      refetchOnMount: "always",
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  });
  async function refresh() {
    await Promise.all([state.refetch(), reloadProject()]);
  }
  const open = state.data?.request;
  const priceText = (price: TemplatePriceDto | null) =>
    price ? formattedPrice(price, locale) : t("pricePending");

  return (
    <Stack
      component="section"
      id="publication-request"
      aria-labelledby="publication-heading"
    >
      <Title id="publication-heading" order={2}>
        {t("publicationTitle")}
      </Title>
      {state.isPending && <Text role="status">{t("loading")}</Text>}
      {(state.isError || projectUnavailable) && (
        <Alert role="alert" color="red">
          <Stack align="start">
            <Text>{t("stateFailed")}</Text>
            <Button
              variant="default"
              onClick={() => void refresh()}
              loading={state.isFetching}
            >
              {t("refresh")}
            </Button>
          </Stack>
        </Alert>
      )}
      {open && (
        <Alert role="status">
          <Stack>
            <Text>{t(open.status === "NEW" ? "received" : "inProgress")}</Text>
            <Text>{t("reference", { id: open.requestId })}</Text>
            {open.submittedRevision !== null && (
              <Text>
                {t("submitted", { revision: open.submittedRevision })}
              </Text>
            )}
            {open.submittedRevision !== open.currentProjectRevision && (
              <Text>{t("editedAfter")}</Text>
            )}
            <Text>{t("quotedPrice", { price: priceText(open.price) })}</Text>
          </Stack>
        </Alert>
      )}
      {state.data && !open && (
        <>
          <Text>{t("publicationIntro")}</Text>
          <Text>
            {t("quote", { price: priceText(state.data.currentPrice) })}
          </Text>
          <ContactRequestForm
            busy={state.isFetching || state.isError || projectUnavailable}
            verify={refresh}
            send={(contacts, options) =>
              createPublicationRequest(
                {
                  ...contacts,
                  projectId,
                  expectedRevision: revision,
                  expectedPriceVersion:
                    state.data?.currentPrice?.version ?? null,
                },
                options,
              )
            }
          />
        </>
      )}
    </Stack>
  );
}
