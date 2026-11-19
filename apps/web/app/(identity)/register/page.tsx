import { RegisterPage } from "@pages/register";
import { safeReturnTo } from "@shared/config/auth-navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return <RegisterPage returnTo={safeReturnTo(params.returnTo)} />;
}
