"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  photoQueryKey,
  uploadPhoto,
  useDraftPhotos,
  usePhotoUrl,
  type PhotoSource,
} from "@entities/project-photo";
import { ApiRequestError } from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";
import {
  Alert,
  Button,
  FileInput,
  Group,
  NativeSelect,
  Stack,
  Text,
  Title,
} from "@shared/ui";
import styles from "./garden-editor.module.css";

function uploadError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 413) return "tooLarge";
    if ([415, 422].includes(error.status)) return "invalidPhoto";
    if (error.code === "PHOTO_LIMIT_REACHED") return "photoLimit";
  }
  return "uploadFailed";
}

export function DraftPhotoField({
  source,
  rejected,
  selected,
  select,
}: {
  source: PhotoSource;
  rejected: boolean;
  selected: string | null;
  select: (id: string | null) => void;
}) {
  const t = useTranslations("DraftPhotos");
  const client = useQueryClient();
  const photos = useDraftPhotos(source);
  const action = useFormAction();
  const [file, setFile] = useState<File | null>(null);
  const key = useRef<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const items = photos.data?.items ?? [];
  const ready = items.filter(({ status }) => status === "READY");
  const selectedPhoto = ready.find(({ id }) => id === selected);
  const image = usePhotoUrl(source, selectedPhoto?.id);
  const description = (id: string, width: number, height: number) =>
    t("item", {
      number: items.length - items.findIndex((item) => item.id === id),
      width,
      height,
    });

  function chooseFile(next: File | null) {
    setFile(next);
    key.current = null;
    setAccepted(false);
  }

  async function upload() {
    if (!file) return;
    const nonce = key.current ?? crypto.randomUUID();
    key.current = nonce;
    await action.run(
      () => uploadPhoto(source, file, nonce),
      () => {
        setAccepted(true);
        setFile(null);
        key.current = null;
        void client.invalidateQueries({ queryKey: photoQueryKey(source) });
      },
    );
  }

  return (
    <Stack component="section">
      <Title order={2}>{t("heading")}</Title>
      <FileInput
        label={t("file")}
        description={t("limits")}
        accept="image/jpeg,image/png,image/webp"
        value={file}
        onChange={chooseFile}
        disabled={action.busy}
        clearable
      />
      <Group>
        <Button
          type="button"
          variant="light"
          onClick={() => void upload()}
          loading={action.busy}
          disabled={!file || action.remaining > 0}
        >
          {t(action.error && key.current ? "retryUpload" : "upload")}
        </Button>
      </Group>
      {accepted && <Text role="status">{t("received")}</Text>}
      {action.error != null && key.current && (
        <Alert role="alert" color="red">
          {t(uploadError(action.error))}
        </Alert>
      )}
      {photos.isPending && <Text role="status">{t("loading")}</Text>}
      {photos.isError && (
        <Alert role="alert" color="red">
          {t("listFailed")}{" "}
          <Button
            type="button"
            variant="subtle"
            onClick={() => void photos.refetch()}
          >
            {t("retry")}
          </Button>
        </Alert>
      )}
      {items.length > 0 && (
        <Stack component="ul" gap="xs">
          {items.map((item) => (
            <li key={item.id}>
              {description(item.id, item.width, item.height)} · {t(item.status)}
            </li>
          ))}
        </Stack>
      )}
      <NativeSelect
        label={t("selection")}
        value={selected ?? ""}
        error={rejected ? t("unavailable") : undefined}
        onChange={(event) => select(event.currentTarget.value || null)}
        data={[
          { value: "", label: t("noPhoto") },
          ...(selected && !selectedPhoto
            ? [{ value: selected, label: t("unavailable") }]
            : []),
          ...ready.map((item) => ({
            value: item.id,
            label: description(item.id, item.width, item.height),
          })),
        ]}
      />
      {image.src && selectedPhoto && (
        <img
          className={styles.coverPreview}
          src={image.src}
          alt={t("coverAlt")}
          width={selectedPhoto.width}
          height={selectedPhoto.height}
        />
      )}
      {image.failed && (
        <Alert role="alert">
          {t("previewFailed")}{" "}
          <Button
            type="button"
            variant="subtle"
            onClick={() => void image.retry()}
          >
            {t("retry")}
          </Button>
        </Alert>
      )}
    </Stack>
  );
}
