"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  GardenInvitation,
  ConfettiInvitation,
  AnniversaryInvitation,
  TogetherInvitation,
  type GardenContent,
} from "@entities/invitation";
import type {
  AnniversaryContentDto,
  ConfettiContentDto,
  TogetherContentDto,
} from "@shared/api";
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
  content:
    | GardenContent
    | TogetherContentDto
    | ConfettiContentDto
    | AnniversaryContentDto;
  rsvp?: ReactNode;
  idPrefix?: string;
}) {
  const t = useTranslations("DraftPhotos");
  const photoId =
    "photo" in content ? content.photo.mediaId : content.heroMediaId;
  const photos = useDraftPhotos(source, photoId !== null);
  const photo = photos.data?.items.find(({ id }) => id === photoId);
  const image = usePhotoUrl(
    source,
    photo?.status === "READY" ? photo.id : undefined,
  );
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
      {"celebrant" in content ? (
        <AnniversaryInvitation
          content={content}
          renderRsvp={rsvp ? () => rsvp : undefined}
          media={
            photo && image.src
              ? {
                  status: "ready",
                  src: image.src,
                  width: photo.width,
                  height: photo.height,
                }
              : photoId
                ? {
                    status:
                      photos.isError ||
                      image.failed ||
                      photo?.status === "FAILED" ||
                      (!photo && photos.isSuccess)
                        ? "unavailable"
                        : "pending",
                  }
                : undefined
          }
        />
      ) : "celebrantName" in content ? (
        <ConfettiInvitation
          content={content}
          renderRsvp={rsvp ? () => rsvp : undefined}
          media={
            photo && image.src
              ? {
                  status: "ready",
                  src: image.src,
                  width: photo.width,
                  height: photo.height,
                }
              : photoId
                ? {
                    status:
                      photos.isError ||
                      image.failed ||
                      photo?.status === "FAILED" ||
                      (!photo && photos.isSuccess)
                        ? "unavailable"
                        : "pending",
                  }
                : undefined
          }
        />
      ) : "photo" in content ? (
        <TogetherInvitation
          content={content}
          renderRsvp={rsvp ? () => rsvp : undefined}
          media={
            photo && image.src
              ? {
                  status: "ready",
                  src: image.src,
                  width: photo.width,
                  height: photo.height,
                  objectUrl: true,
                }
              : photoId
                ? {
                    status:
                      photos.isError ||
                      image.failed ||
                      photo?.status === "FAILED" ||
                      (!photo && photos.isSuccess)
                        ? "unavailable"
                        : "pending",
                  }
                : undefined
          }
        />
      ) : (
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
      )}
    </Stack>
  );
}
