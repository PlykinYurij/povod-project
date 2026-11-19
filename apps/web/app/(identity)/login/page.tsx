import { LoginPage } from "@pages/login";
import { safeReturnTo } from "@shared/config/auth-navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return <LoginPage returnTo={safeReturnTo(params.returnTo)} />;
}
