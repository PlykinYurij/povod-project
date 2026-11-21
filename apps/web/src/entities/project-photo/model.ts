import {
  getAssistedPhotoImage,
  getListAssistedPhotosQueryKey,
  getListProjectPhotosQueryKey,
  getProjectPhotoImage,
  listAssistedPhotos,
  listProjectPhotos,
  uploadAssistedPhoto,
  uploadProjectPhoto,
} from "@shared/api";

export type PhotoSource = { kind: "owner" | "assisted"; id: string };

export function photoQueryKey({ kind, id }: PhotoSource) {
  return kind === "owner"
    ? getListProjectPhotosQueryKey(id)
    : getListAssistedPhotosQueryKey(id);
}

export function listPhotos({ kind, id }: PhotoSource, signal: AbortSignal) {
  return (kind === "owner" ? listProjectPhotos : listAssistedPhotos)(id, {
    signal,
  });
}

export function uploadPhoto(
  { kind, id }: PhotoSource,
  file: File,
  key: string,
) {
  return (kind === "owner" ? uploadProjectPhoto : uploadAssistedPhoto)(
    id,
    { file },
    {
      headers: { "Idempotency-Key": key },
      signal: AbortSignal.timeout(60_000),
    },
  );
}

export function readPhoto(
  { kind, id }: PhotoSource,
  photoId: string,
  signal: AbortSignal,
) {
  return (kind === "owner" ? getProjectPhotoImage : getAssistedPhotoImage)(
    id,
    photoId,
    { signal },
  );
}
