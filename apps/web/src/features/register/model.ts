import type { RegistrationPendingDto } from "@shared/api";
export type PendingRegistration = RegistrationPendingDto & { email: string };
