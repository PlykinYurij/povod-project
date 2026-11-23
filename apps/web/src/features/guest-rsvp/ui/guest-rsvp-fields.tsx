import { useWatch, type UseFormReturn } from "react-hook-form";
import type { PublicRsvpFormDto, SubmitRsvpDto } from "@shared/api";
import type { Locale } from "@shared/config/locale";
import { getGardenTranslations } from "@shared/i18n/garden";
import styles from "./guest-rsvp.module.css";

export type RsvpValues = {
  name: string;
  attendance: "" | SubmitRsvpDto["attendance"];
  companions: string;
};

export function GuestRsvpFields({
  form,
  schema,
  locale,
  fieldErrors,
  disabled,
}: {
  form: UseFormReturn<RsvpValues>;
  schema: PublicRsvpFormDto;
  locale: Locale;
  fieldErrors: string[];
  disabled: boolean;
}) {
  const t = getGardenTranslations(locale);
  const attendance = useWatch({ control: form.control, name: "attendance" });
  const attendanceField = form.register("attendance", {
    required: t("rsvpAttendanceRequired"),
    onChange: (event) => {
      if (event.target.value === "no") form.setValue("companions", "0");
    },
  });
  const errors = form.formState.errors;
  const nameError =
    errors.name?.message ??
    (fieldErrors.includes("name")
      ? t("rsvpNameInvalid", { max: schema.nameMaxLength })
      : undefined);
  const attendanceError =
    errors.attendance?.message ??
    (fieldErrors.includes("attendance")
      ? t("rsvpAttendanceRequired")
      : undefined);
  const companionsError =
    errors.companions?.message ??
    (fieldErrors.includes("companions")
      ? t("rsvpCompanionsInvalid")
      : undefined);

  return (
    <fieldset className={styles.fields} disabled={disabled}>
      <label className={styles.field}>
        {t("rsvpName")}
        <input
          aria-invalid={!!nameError}
          aria-describedby={nameError ? "guest-rsvp-name-error" : undefined}
          autoComplete="name"
          required
          {...form.register("name", {
            validate: (value) => {
              const clean = value.trim();
              return (
                (!!clean &&
                  [...clean].length <= schema.nameMaxLength &&
                  !/[\p{Cc}\p{Cs}]/u.test(clean)) ||
                t("rsvpNameInvalid", { max: schema.nameMaxLength })
              );
            },
          })}
        />
        {nameError && (
          <span
            className={styles.error}
            id="guest-rsvp-name-error"
            role="alert"
          >
            {nameError}
          </span>
        )}
      </label>

      <fieldset
        className={styles.options}
        aria-describedby={
          attendanceError ? "guest-rsvp-attendance-error" : undefined
        }
      >
        <legend>{t("rsvpAttendance")}</legend>
        <label>
          <input type="radio" value="yes" {...attendanceField} /> {t("rsvpYes")}
        </label>
        <label>
          <input type="radio" value="no" {...attendanceField} /> {t("rsvpNo")}
        </label>
        {attendanceError && (
          <span
            className={styles.error}
            id="guest-rsvp-attendance-error"
            role="alert"
          >
            {attendanceError}
          </span>
        )}
      </fieldset>

      {attendance === "yes" && (
        <label className={styles.field}>
          {t("rsvpCompanions")}
          <select
            aria-invalid={!!companionsError}
            aria-describedby={
              companionsError ? "guest-rsvp-companions-error" : undefined
            }
            {...form.register("companions", {
              validate: (value) =>
                (/^\d+$/.test(value) &&
                  Number(value) <= schema.maxCompanions) ||
                t("rsvpCompanionsInvalid"),
            })}
          >
            {Array.from({ length: schema.maxCompanions + 1 }, (_, value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {companionsError && (
            <span
              className={styles.error}
              id="guest-rsvp-companions-error"
              role="alert"
            >
              {companionsError}
            </span>
          )}
        </label>
      )}
    </fieldset>
  );
}
