import { HomePage } from "@pages/home";
import {
  GuestInvitationPage,
  guestInvitationMetadata,
} from "@pages/guest-invitation";
import { publicationSurface } from "@shared/config/publication-host";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export async function generateMetadata() {
  const surface = publicationSurface((await headers()).get("host"));
  if (surface.kind !== "guest") return {};
  return guestInvitationMetadata(surface.slug, surface.hostname);
}

export default async function Page() {
  const surface = publicationSurface((await headers()).get("host"));
  if (surface.kind === "invalid") notFound();
  if (surface.kind === "guest")
    return <GuestInvitationPage slug={surface.slug} />;
  return <HomePage />;
}
