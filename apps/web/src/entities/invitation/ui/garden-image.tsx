"use client";
import { useState } from "react";
import styles from "./garden-invitation.module.css";

/** Only the image lifecycle is interactive; the invitation itself stays on the server. */
export function GardenImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
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
        Не удалось загрузить фото. Обновите страницу, чтобы попробовать ещё раз.
      </div>
    );
  return (
    <div className={styles.imageContainer}>
      {state === "loading" && (
        <p className={styles.imageStatus} role="status">
          Фото загружается…
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
