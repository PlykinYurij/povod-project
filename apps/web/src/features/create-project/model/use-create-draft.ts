"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiRequestError,
  createProject,
  getGetProjectsQueryKey,
} from "@shared/api";
import { ACCOUNT_ROUTE } from "@shared/config/auth-navigation";
import { useFormAction } from "@shared/lib/use-form-action";

export function useCreateDraft(
  templateVersionId: string,
  onUnauthorized: () => void,
) {
  const attempt = useRef<{ key: string; title: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const action = useFormAction();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function submit(title: string) {
    await action.run(
      async () => {
        const request = attempt.current ?? { key: crypto.randomUUID(), title };
        attempt.current = request;
        try {
          const project = await createProject(
            { title: request.title, templateVersionId },
            {
              headers: { "Idempotency-Key": request.key },
              signal: AbortSignal.timeout(15_000),
            },
          );
          // Keep the submitted title/key through route navigation, even after success.
          if (action.isActive()) setUncertain(true);
          return project;
        } catch (error) {
          if (action.isActive()) {
            if (error instanceof ApiRequestError && error.status === 401)
              onUnauthorized();
            const rejected =
              error instanceof ApiRequestError &&
              error.status >= 400 &&
              error.status < 500 &&
              error.code !== "IDEMPOTENCY_KEY_REUSED";
            if (rejected && !uncertain) attempt.current = null;
            if (!rejected) setUncertain(true);
          }
          throw error;
        }
      },
      () => {
        void queryClient.invalidateQueries({
          queryKey: getGetProjectsQueryKey(),
        });
        router.replace(ACCOUNT_ROUTE);
      },
    );
  }

  return { ...action, uncertain, submit };
}
