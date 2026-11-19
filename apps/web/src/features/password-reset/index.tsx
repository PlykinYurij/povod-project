"use client";
import { useState } from "react";
import { ResetStart } from "./ui/reset-start";
import { ResetCode } from "./ui/reset-code";
import { ResetSuccess } from "./ui/reset-success";
type ResetStep =
  { stage: "email" } | { stage: "code"; email: string } | { stage: "complete" };
export function PasswordResetForm() {
  const [step, setStep] = useState<ResetStep>({ stage: "email" });
  if (step.stage === "complete") return <ResetSuccess />;
  if (step.stage === "email")
    return (
      <ResetStart onAccepted={(email) => setStep({ stage: "code", email })} />
    );
  return (
    <ResetCode
      email={step.email}
      onRestart={() => setStep({ stage: "email" })}
      onComplete={() => setStep({ stage: "complete" })}
    />
  );
}
