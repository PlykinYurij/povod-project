"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { safePublicationUrl, type PublicationReceiptDto } from "@shared/api";
import { Button, Group, Stack, Text, TextInput } from "@shared/ui";

export function PublishedLink({ receipt }: { receipt: PublicationReceiptDto }) {
  const t = useTranslations("AdminPublish");
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  if (!safePublicationUrl(receipt.url)) {
    return <Text role="alert">{t("invalidReceipt")}</Text>;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(receipt.url);
      setCopy("copied");
    } catch {
      setCopy("manual");
    }
  }

  return (
    <Stack align="start">
      <Text fw={600}>{t("published")}</Text>
      <TextInput
        label={t("linkLabel")}
        value={receipt.url}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
        w="100%"
      />
      <Group>
        <Button variant="default" onClick={() => void copyLink()}>
          {t("copy")}
        </Button>
        <Button
          component="a"
          href={receipt.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("open")}
        </Button>
      </Group>
      {copy !== "idle" && <Text role="status">{t(copy)}</Text>}
    </Stack>
  );
}
