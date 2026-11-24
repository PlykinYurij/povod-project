import { strToU8, zipSync } from "fflate";
import type { RsvpDashboardDto } from "./rsvp-dashboard.dto";

export const RSVP_XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const sheetNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const officeNs =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const pkgNs = "http://schemas.openxmlformats.org/package/2006";
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

type Row = [string, string, string | number, string];

export function rsvpWorkbook(items: RsvpDashboardDto["items"]): Buffer {
  const rows: Row[] = [
    ["Имя или псевдоним", "Участие", "Сопровождающие", "Получен (UTC)"],
    ...items.map(({ name, attendance, companions, receivedAt }): Row => [
      name,
      attendance === "yes" ? "Придёт" : "Не придёт",
      companions,
      receivedAt,
    ]),
  ];
  const parts = {
    "[Content_Types].xml": `<Types xmlns="${pkgNs}/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    </Types>`,
    "_rels/.rels": relationship("officeDocument", "xl/workbook.xml"),
    "xl/workbook.xml": `<workbook xmlns="${sheetNs}" xmlns:r="${officeNs}">
      <bookViews><workbookView/></bookViews>
      <sheets><sheet name="Ответы гостей" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`,
    "xl/_rels/workbook.xml.rels": relationship(
      "worksheet",
      "worksheets/sheet1.xml",
    ),
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${sheetNs}">
      <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
      <cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="3" width="23" customWidth="1"/><col min="4" max="4" width="29" customWidth="1"/></cols>
      <sheetData>${rows.map(writeRow).join("")}</sheetData>
      <autoFilter ref="A1:D${rows.length}"/>
    </worksheet>`,
  };
  return Buffer.from(
    zipSync(
      Object.fromEntries(
        Object.entries(parts).map(([path, xml]) => [
          path,
          strToU8(xmlHeader + xml),
        ]),
      ),
    ),
  );
}

function relationship(type: string, target: string): string {
  return `<Relationships xmlns="${pkgNs}/relationships">
    <Relationship Id="rId1" Type="${officeNs}/${type}" Target="${target}"/>
  </Relationships>`;
}

function writeRow(row: Row, index: number): string {
  const number = index + 1;
  const cells = row.map((value, column) => {
    const cell = `${"ABCD"[column]}${number}`;
    if (typeof value === "number") return `<c r="${cell}"><v>${value}</v></c>`;
    // An inline string remains text even when its first character is =, +, - or @.
    return `<c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${escapeWorkbookText(value)}</t></is></c>`;
  });
  return `<row r="${number}">${cells.join("")}</row>`;
}

function escapeWorkbookText(value: string): string {
  return value
    .replace(/_(?=x[0-9a-f]{4}_)/gi, "_x005F_")
    .replace(/\ufffe/g, "_xFFFE_")
    .replace(/\uffff/g, "_xFFFF_")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
