import { ConfettiInvitation, type ConfettiMedia } from "@entities/invitation";
import {
  confettiDemoContent,
  confettiDemoMessages,
  resolveSample,
} from "./demo-content";

export { confettiDemoMessages } from "./demo-content";

export function ConfettiDemoPage({
  locale,
  sample: input,
}: {
  locale: "ru" | "en";
  sample?: string | string[];
}) {
  const sample = resolveSample(input);
  const t = confettiDemoMessages[locale];
  let media: ConfettiMedia | undefined;
  if (sample === "full")
    media = {
      status: "ready",
      src: "/templates/confetti/cover.svg",
      width: 960,
      height: 640,
    };
  if (sample === "pending" || sample === "unavailable")
    media = { status: sample };
  return (
    <>
      <form method="get">
        <p>{t.notice}</p>
        <label htmlFor="confetti-sample">{t.state} </label>
        <select id="confetti-sample" name="sample" defaultValue={sample}>
          {Object.entries(t.samples).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit">{t.show}</button>
      </form>
      <ConfettiInvitation
        content={confettiDemoContent(locale, sample)}
        media={media}
      />
    </>
  );
}
