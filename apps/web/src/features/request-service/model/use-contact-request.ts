"use client";

import { useRef, useState } from "react";
import {
  ApiRequestError,
  type CreateServiceRequestDto,
  type ServiceRequestReceiptDto,
} from "@shared/api";
import { useFormAction } from "@shared/lib/use-form-action";

export type SendContactRequest = (
  contacts: CreateServiceRequestDto,
  options: RequestInit,
) => Promise<ServiceRequestReceiptDto>;

export function useContactRequest(send: SendContactRequest) {
  const attempt = useRef<{
    contacts: CreateServiceRequestDto;
    key: string;
    send: SendContactRequest;
  } | null>(null);
  const action = useFormAction();
  const [receipt, setReceipt] = useState<ServiceRequestReceiptDto>();
  const [uncertain, setUncertain] = useState(false);

  function submit(contacts: CreateServiceRequestDto) {
    return action.run(async () => {
      const request = attempt.current ?? {
        contacts,
        key: crypto.randomUUID(),
        send,
      };
      attempt.current = request;
      try {
        return await request.send(request.contacts, {
          headers: { "Idempotency-Key": request.key },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        if (action.isActive()) {
          const definitive =
            error instanceof ApiRequestError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.code !== "IDEMPOTENCY_KEY_REUSED";
          if (definitive && !uncertain) attempt.current = null;
          if (!definitive) setUncertain(true);
        }
        throw error;
      }
    }, setReceipt);
  }

  return { ...action, submit, receipt, uncertain };
}
