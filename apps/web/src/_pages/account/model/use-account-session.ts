"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, useGetSession } from "@shared/api";
import { clearPrivateQueries } from "@shared/api/private-cache";
import { loginHref } from "@shared/config/auth-navigation";

export function useAccountSession(leaving: boolean) {
  const router = useRouter();
  const client = useQueryClient();
  const session = useGetSession({
    query: { enabled: !leaving, retry: false, refetchOnWindowFocus: true },
  });
  const unauthorized =
    session.error instanceof ApiRequestError && session.error.status === 401;
  const redirecting = useRef(false);
  useEffect(() => {
    if (!unauthorized || leaving || redirecting.current) return;
    redirecting.current = true;
    const target = loginHref(
      window.location.pathname + window.location.search + window.location.hash,
    );
    void clearPrivateQueries(client).then(() => router.replace(target));
  }, [unauthorized, leaving, client, router]);
  return { session, unauthorized };
}
