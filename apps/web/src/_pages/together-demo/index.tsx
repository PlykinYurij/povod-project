import Link from "next/link";
import { TogetherInvitation } from "@entities/invitation";
import type { Locale } from "@shared/config/locale";
import {
  demoStates,
  selectTogetherDemo,
  togetherDemoMessages,
} from "./demo-content";
import styles from "./demo.module.css";

export { togetherDemoMessages } from "./demo-content";

export function TogetherDemoPage({
  locale,
  sample,
}: {
  locale: Locale;
  sample: unknown;
}) {
  const messages = togetherDemoMessages[locale];
  const { state, content } = selectTogetherDemo(locale, sample);
  return (
    <main>
      <header className={styles.toolbar}>
        <Link href="/templates">{messages.back}</Link>
        <p>{messages.title}</p>
        <form method="get" className={styles.controls}>
          <label>
            {messages.sample}
            <select name="sample" defaultValue={state}>
              {demoStates.map((option) => (
                <option key={option} value={option}>
                  {messages.states[option]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">{messages.apply}</button>
        </form>
        <p>{messages.notice}</p>
      </header>
      <TogetherInvitation
        content={content}
        media={
          state === "pending" || state === "unavailable"
            ? { status: state }
            : undefined
        }
        renderRsvp={({ label, className }) => (
          <button type="button" className={className} disabled>
            {label}
          </button>
        )}
      />
    </main>
  );
}
