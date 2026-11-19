import type { GardenMedia } from "../model/garden-content";
import { safeGardenImage } from "../lib/presentation";
import { GardenImage } from "./garden-image";
import styles from "./garden-invitation.module.css";

export function GardenPhoto({
  mediaId,
  media,
}: {
  mediaId: string | null;
  media?: GardenMedia;
}) {
  if (!mediaId) return null;
  const src = media?.id === mediaId ? safeGardenImage(media.src) : null;
  if (
    !media ||
    !src ||
    !Number.isFinite(media.width) ||
    !Number.isFinite(media.height) ||
    media.width <= 0 ||
    media.height <= 0
  ) {
    return (
      <div className={styles.photoPending} role="status">
        Выбранное фото пока недоступно. Оно появится после подготовки.
      </div>
    );
  }
  return (
    <div className={styles.photoFrame}>
      <GardenImage
        key={src}
        src={src}
        alt={media.alt}
        width={media.width}
        height={media.height}
      />
    </div>
  );
}
