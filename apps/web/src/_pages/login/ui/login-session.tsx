"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, useGetSession } from "@shared/api";
import { safeReturnTo } from "@shared/config/auth-navigation";
import { SessionLoading, SessionFailure } from "@entities/identity";
import { GuestLogin } from "./guest-login";

export function LoginSession({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [checkedGuest, setCheckedGuest] = useState(false);
  const session = useGetSession({
    query: {
      retry: false,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const unauthorized =
    session.error instanceof ApiRequestError && session.error.status === 401;
  const authenticated =
    !!session.data && !session.isError && !session.isFetching;
  useEffect(() => {
    if (unauthorized) setCheckedGuest(true);
  }, [unauthorized]);
  useEffect(() => {
    if (authenticated) router.replace(safeReturnTo(returnTo));
  }, [authenticated, returnTo, router]);
  if (
    authenticated ||
    (!checkedGuest && (session.isPending || session.isFetching))
  )
    return <SessionLoading />;
  if (session.isError && !unauthorized)
    return <SessionFailure retry={() => void session.refetch()} />;
  if (!checkedGuest) return <SessionLoading />;
  return <GuestLogin returnTo={returnTo} />;
}
