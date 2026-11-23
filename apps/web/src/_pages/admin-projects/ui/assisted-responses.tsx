"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Stack, Title } from "@shared/ui";
import { RsvpDashboard } from "@widgets/rsvp-dashboard";

export function AssistedResponses({ requestId }: { requestId: string }) {
  const t = useTranslations("RsvpDashboard");
  const [open, setOpen] = useState(false);
  return (
    <Stack component="section" aria-label={t("heading")}>
      <Button
        variant="light"
        w="fit-content"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {t(open ? "close" : "open")}
      </Button>
      {open && (
        <>
          <Title order={3}>{t("heading")}</Title>
          <RsvpDashboard scope={{ kind: "assisted", id: requestId }} />
        </>
      )}
    </Stack>
  );
}
