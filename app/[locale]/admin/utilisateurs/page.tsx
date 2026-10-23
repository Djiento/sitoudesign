import { notFound, redirect } from "next/navigation";
import StaffUserManager from "@/components/admin/StaffUserManager";
import { getStaffSession } from "@/lib/admin-auth";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function StaffUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (staff?.role !== "ADMIN") redirect(`/${locale}/admin/caisse`);
  return <StaffUserManager />;
}
