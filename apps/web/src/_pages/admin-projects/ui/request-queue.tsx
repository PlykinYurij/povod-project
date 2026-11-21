"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SessionFailure, SessionLoading } from "@entities/identity";
import { useListAdminRequests } from "@shared/api";
import { Button, Group, Stack, Table, Text } from "@shared/ui";
import { RequestDetail } from "./request-detail";

export function RequestQueue() {
  const t = useTranslations("AdminRequests");
  const locale = useLocale();
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>();
  const after = history.at(-1);
  const queue = useListAdminRequests(after ? { after } : undefined, {
    query: { retry: false },
  });
  if (queue.isPending) return <SessionLoading />;
  if (queue.isError || !queue.data)
    return <SessionFailure retry={() => void queue.refetch()} />;
  const next = queue.data.next;
  const timestamp = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
  function switchPage(cursors: string[]) {
    setSelected(undefined);
    setHistory(cursors);
  }
  return (
    <Stack>
      {queue.data.items.length === 0 ? (
        <Text role="status">{t("empty")}</Text>
      ) : (
        <Table.ScrollContainer minWidth={690}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">{t("created")}</Table.Th>
                <Table.Th scope="col">{t("type")}</Table.Th>
                <Table.Th scope="col">{t("template")}</Table.Th>
                <Table.Th scope="col">{t("project")}</Table.Th>
                <Table.Th scope="col">{t("customer")}</Table.Th>
                <Table.Th scope="col">{t("status")}</Table.Th>
                <Table.Th scope="col">{t("actions")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {queue.data.items.map((row) => (
                <Table.Tr
                  key={row.id}
                  bg={
                    selected === row.id
                      ? "var(--mantine-color-default-hover)"
                      : undefined
                  }
                >
                  <Table.Td>
                    {timestamp.format(new Date(row.createdAt))}
                  </Table.Td>
                  <Table.Td>{t(row.kind)}</Table.Td>
                  <Table.Td>{row.templateId ?? "—"}</Table.Td>
                  <Table.Td>{row.projectTitle ?? "—"}</Table.Td>
                  <Table.Td>
                    {row.userName ??
                      t(row.hasAccount ? "unnamed" : "noAccount")}
                  </Table.Td>
                  <Table.Td>{t(row.status)}</Table.Td>
                  <Table.Td>
                    <Button
                      variant="subtle"
                      onClick={() => setSelected(row.id)}
                      aria-pressed={selected === row.id}
                    >
                      {t("details")}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <Group>
        {history.length > 0 && (
          <Button
            variant="default"
            onClick={() => switchPage(history.slice(0, -1))}
          >
            {t("previous")}
          </Button>
        )}
        {next && (
          <Button
            variant="default"
            onClick={() => switchPage([...history, next])}
          >
            {t("next")}
          </Button>
        )}
      </Group>
      {selected && <RequestDetail key={selected} requestId={selected} />}
    </Stack>
  );
}
