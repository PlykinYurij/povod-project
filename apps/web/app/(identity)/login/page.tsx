import { LoginPage } from "../../../src/_pages/login";
import { safeReturnTo } from "../../../src/shared/config/auth-navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return <LoginPage returnTo={safeReturnTo(params.returnTo)} />;
}
