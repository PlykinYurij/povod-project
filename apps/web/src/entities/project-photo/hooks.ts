"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listPhotos,
  photoQueryKey,
  readPhoto,
  type PhotoSource,
} from "./model";

export function useDraftPhotos(source: PhotoSource, enabled = true) {
  return useQuery({
    queryKey: photoQueryKey(source),
    queryFn: ({ signal }) => listPhotos(source, signal),
    enabled,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.items.some(({ status }) => status === "PROCESSING")
        ? 2_000
        : false,
  });
}

export function usePhotoUrl(source: PhotoSource, photoId: string | undefined) {
  const { kind, id } = source;
  const query = useQuery({
    queryKey: ["privatePhoto", kind, id, photoId],
    queryFn: ({ signal }) => {
      if (!photoId) throw new Error("Photo id required");
      return readPhoto({ kind, id }, photoId, signal);
    },
    enabled: !!photoId,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const blob = query.data;
  const [preview, setPreview] = useState<{ blob: Blob; src: string }>();
  useEffect(() => {
    if (!blob) return;
    const src = URL.createObjectURL(blob);
    setPreview({ blob, src });
    return () => URL.revokeObjectURL(src);
  }, [blob]);
  return {
    src: preview?.blob === blob ? preview?.src : undefined,
    failed: query.isError,
    retry: query.refetch,
  };
}
