"use client";
import { useState } from "react";
import type { Locale } from "@shared/config/locale";
import { getGardenTranslations } from "@shared/i18n/garden";
import styles from "./garden-invitation.module.css";

/** Only the image lifecycle is interactive; the invitation itself stays on the server. */
export function GardenImage({
  src,
  alt,
  width,
  height,
  locale,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  locale: Locale;
}) {
  const t = getGardenTranslations(locale);
  const [state, setState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  function checkCachedImage(image: HTMLImageElement | null) {
    // A cached SSR image can finish before React attaches onLoad/onError.
    if (state === "loading" && image?.complete) {
      setState(image.naturalWidth > 0 ? "loaded" : "failed");
    }
  }
  if (state === "failed")
    return (
      <div className={styles.photoPending} role="alert">
        {t("photoFailed")}
      </div>
    );
  return (
    <div className={styles.imageContainer}>
      {state === "loading" && (
        <p className={styles.imageStatus} role="status">
          {t("photoLoading")}
        </p>
      )}
      <img
        ref={checkCachedImage}
        className={styles.photo}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
      />
    </div>
  );
}
