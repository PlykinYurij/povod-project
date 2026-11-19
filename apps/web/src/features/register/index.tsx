"use client";
import { useState } from "react";
import type { PendingRegistration } from "./model";
import { RegistrationStart } from "./ui/registration-start";
import { RegistrationCode } from "./ui/registration-code";
export function RegistrationForm({ returnTo }: { returnTo: string }) {
  const [pending, setPending] = useState<PendingRegistration>();
  if (!pending) return <RegistrationStart onPending={setPending} />;
  return (
    <RegistrationCode
      pending={pending}
      onRestart={() => setPending(undefined)}
      returnTo={returnTo}
    />
  );
}
