import {
  AnniversaryInvitation,
  type AnniversaryMedia,
} from "@entities/invitation";
import {
  anniversaryDemoContent,
  anniversaryDemoMessages,
  resolveSample,
} from "./demo-content";

export { anniversaryDemoMessages } from "./demo-content";

export function AnniversaryDemoPage({
  locale,
  sample: input,
}: {
  locale: "ru" | "en";
  sample?: string | string[];
}) {
  const sample = resolveSample(input);
  const t = anniversaryDemoMessages[locale];
  let media: AnniversaryMedia | undefined;
  if (sample === "full")
    media = {
      status: "ready",
      src: "/templates/anniversary/cover.svg",
      width: 960,
      height: 640,
    };
  if (sample === "pending" || sample === "unavailable")
    media = { status: sample };
  return (
    <>
      <form method="get">
        <p>{t.notice}</p>
        <label htmlFor="anniversary-sample">{t.state} </label>
        <select id="anniversary-sample" name="sample" defaultValue={sample}>
          {Object.entries(t.samples).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit">{t.show}</button>
      </form>
      <AnniversaryInvitation
        content={anniversaryDemoContent(locale, sample)}
        media={media}
      />
    </>
  );
}
