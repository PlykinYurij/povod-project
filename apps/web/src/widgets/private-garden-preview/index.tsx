"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { GardenInvitation, type GardenContent } from "@entities/invitation";
import {
  useDraftPhotos,
  usePhotoUrl,
  type PhotoSource,
} from "@entities/project-photo";
import { Alert, Button, Stack } from "@shared/ui";

export function PrivateGardenPreview({
  source,
  content,
  rsvp,
  idPrefix,
}: {
  source: PhotoSource;
  content: GardenContent;
  rsvp?: ReactNode;
  idPrefix?: string;
}) {
  const t = useTranslations("DraftPhotos");
  const photos = useDraftPhotos(source, content.heroMediaId !== null);
  const photo = photos.data?.items.find(
    ({ id, status }) => id === content.heroMediaId && status === "READY",
  );
  const image = usePhotoUrl(source, photo?.id);
  return (
    <Stack>
      {(photos.isError || image.failed) && (
        <Alert role="alert" color="red">
          {t("previewFailed")}{" "}
          <Button
            variant="subtle"
            onClick={() =>
              void (photos.isError ? photos.refetch() : image.retry())
            }
          >
            {t("retry")}
          </Button>
        </Alert>
      )}
      <GardenInvitation
        content={content}
        rsvp={rsvp}
        idPrefix={idPrefix}
        media={
          photo && image.src
            ? {
                id: photo.id,
                src: image.src,
                objectUrl: true,
                alt: t("coverAlt"),
                width: photo.width,
                height: photo.height,
              }
            : undefined
        }
      />
    </Stack>
  );
}
