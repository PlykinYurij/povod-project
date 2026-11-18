import { RegisterPage } from "../../../src/_pages/register";
import { safeReturnTo } from "../../../src/shared/config/auth-navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return <RegisterPage returnTo={safeReturnTo(params.returnTo)} />;
}
