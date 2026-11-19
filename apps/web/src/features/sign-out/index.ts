"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLogout } from "@shared/api";
import { clearPrivateQueries } from "@shared/api/private-cache";

export function useSignOut() {
  const router = useRouter();
  const client = useQueryClient();
  const mutation = useLogout();
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    if (mutation.isPending) return;
    setLeaving(true);
    setFailed(false);
    await clearPrivateQueries(client);
    try {
      await mutation.mutateAsync();
      client.clear();
      router.replace("/login");
    } catch {
      setFailed(true);
    }
  }
  return { signOut, leaving, failed };
}
