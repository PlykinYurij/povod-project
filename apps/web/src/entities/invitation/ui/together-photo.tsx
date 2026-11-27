"use client";

import { useState } from "react";
import styles from "./together-invitation.module.css";

export function TogetherPhoto({
  src,
  alt,
  width,
  height,
  unavailable,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  unavailable: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p role="status">{unavailable}</p>;

  return (
    // The media URL is supplied by the invitation flow, including local preview blobs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.photo}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
