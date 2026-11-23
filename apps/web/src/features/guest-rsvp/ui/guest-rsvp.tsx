"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ApiRequestError,
  submitPublicRsvp,
  type PublicRsvpFormDto,
  type SubmitRsvpDto,
} from "@shared/api";
import type { Locale } from "@shared/config/locale";
import { getGardenTranslations } from "@shared/i18n/garden";
import { useFormAction } from "@shared/lib/use-form-action";
import { rsvpRequestKey } from "../model/request-key";
import { GuestRsvpFields, type RsvpValues } from "./guest-rsvp-fields";
import styles from "./guest-rsvp.module.css";

type Attempt = { body: SubmitRsvpDto; key: string };

export function GuestRsvp({
  slug,
  schema,
  locale,
}: {
  slug: string;
  schema: PublicRsvpFormDto;
  locale: Locale;
}) {
  const t = getGardenTranslations(locale);
  const form = useForm<RsvpValues>({
    defaultValues: { name: "", attendance: "", companions: "0" },
  });
  const attempt = useRef<Attempt | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { run, busy, error, remaining } = useFormAction();
  const apiError = error instanceof ApiRequestError ? error : undefined;
  const uncertain = !!error && (!apiError || apiError.status >= 500);
  const terminal =
    apiError?.code === "RSVP_LIMIT_REACHED"
      ? "rsvpLimit"
      : apiError?.status === 404
        ? "rsvpUnavailable"
        : undefined;
  const refresh =
    apiError?.code === "RSVP_FORM_CHANGED" ||
    apiError?.code === "IDEMPOTENCY_KEY_REUSED";
  const invalid = apiError?.status === 422;
  const fieldErrors = invalid ? apiError.fields.map(({ path }) => path) : [];
  function send(request: Attempt) {
    return run(
      () =>
        submitPublicRsvp(slug, request.body, {
          headers: { "Idempotency-Key": request.key },
          signal: AbortSignal.timeout(12_000),
        }),
      () => setSubmitted(true),
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!values.attendance || uncertain || refresh || remaining) return;
    const body: SubmitRsvpDto = {
      formVersionId: schema.formVersionId,
      name: values.name.trim(),
      attendance: values.attendance,
      companions: values.attendance === "yes" ? Number(values.companions) : 0,
    };
    const existing = attempt.current;
    const request =
      existing && JSON.stringify(existing.body) === JSON.stringify(body)
        ? existing
        : { body, key: rsvpRequestKey() };
    attempt.current = request;
    return send(request);
  });

  if (submitted)
    return (
      <p className={styles.notice} role="status">
        {t("rsvpSuccess")}
      </p>
    );
  if (terminal)
    return (
      <p className={styles.notice} role="alert">
        {t(terminal)}
      </p>
    );

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={onSubmit}
      aria-busy={busy}
    >
      <GuestRsvpFields
        form={form}
        schema={schema}
        locale={locale}
        fieldErrors={fieldErrors}
        disabled={busy || uncertain || refresh}
      />

      {refresh && (
        <p role="alert" className={styles.error}>
          {t("rsvpChanged")}
        </p>
      )}
      {uncertain && (
        <p role="alert" className={styles.error}>
          {t("rsvpUncertain")}
        </p>
      )}
      {apiError?.status === 429 && (
        <p role="status" className={styles.error}>
          {remaining > 0
            ? t("rsvpRate", { seconds: remaining })
            : t("rsvpRateReady")}
        </p>
      )}
      {apiError &&
        !(
          refresh ||
          uncertain ||
          apiError.status === 429 ||
          fieldErrors.length
        ) && (
          <p role="alert" className={styles.error}>
            {t(invalid ? "rsvpInvalid" : "rsvpFailed")}
          </p>
        )}

      {refresh ? (
        <button type="button" onClick={() => window.location.reload()}>
          {t("rsvpReload")}
        </button>
      ) : uncertain ? (
        <button
          type="button"
          onClick={() => {
            if (attempt.current) void send(attempt.current);
          }}
        >
          {t("rsvpRetry")}
        </button>
      ) : (
        <button type="submit" disabled={busy || remaining > 0}>
          {t(busy ? "rsvpSubmitting" : "rsvpSubmit")}
        </button>
      )}
    </form>
  );
}
