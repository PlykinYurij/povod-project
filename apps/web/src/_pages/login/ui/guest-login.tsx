"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SignInForm } from "@features/sign-in";
import { safeReturnTo } from "@shared/config/auth-navigation";
import { Text } from "@shared/ui";
import formStyles from "@shared/ui/identity-form/form.module.css";

export function GuestLogin({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Auth");
  const identity = useTranslations("Identity");
  const registerHref = `/register?${new URLSearchParams({ returnTo: safeReturnTo(returnTo) })}`;
  return (
    <>
      <Text mt="sm">{t("intro")}</Text>
      <SignInForm returnTo={returnTo} />
      <nav className={formStyles.links} aria-label={identity("navigation")}>
        <Link href={registerHref}>{identity("register")}</Link>
        <Link href="/password-reset">{identity("forgotPassword")}</Link>
      </nav>
    </>
  );
}
