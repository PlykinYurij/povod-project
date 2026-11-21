"use client";

import { createServiceRequest } from "@shared/api";
import { ContactRequestForm } from "./contact-request-form";

export function PublicRequestForm() {
  return <ContactRequestForm send={createServiceRequest} />;
}
