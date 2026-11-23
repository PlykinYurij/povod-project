import { useTranslations } from "next-intl";
import type { RsvpDashboardRowDto } from "@shared/api";
import { Table } from "@shared/ui";
import styles from "../rsvp-dashboard.module.css";

export function ResponseTable({
  items,
  locale,
}: {
  items: RsvpDashboardRowDto[];
  locale: string;
}) {
  const t = useTranslations("RsvpDashboard");
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
  return (
    <div
      className={styles.table}
      role="region"
      aria-label={t("heading")}
      tabIndex={0}
    >
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">{t("name")}</Table.Th>
            <Table.Th scope="col">{t("attendance")}</Table.Th>
            <Table.Th scope="col">{t("companions")}</Table.Th>
            <Table.Th scope="col">{t("receivedAt")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{row.name}</Table.Td>
              <Table.Td>{t(row.attendance)}</Table.Td>
              <Table.Td>{row.companions}</Table.Td>
              <Table.Td>
                <time dateTime={row.receivedAt}>
                  {format.format(new Date(row.receivedAt))}
                </time>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
