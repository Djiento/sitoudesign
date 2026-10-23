import { notFound, redirect } from "next/navigation";
import AuditLog from "@/components/admin/AuditLog";
import { getStaffSession } from "@/lib/admin-auth";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (staff?.role !== "ADMIN") redirect(`/${locale}/admin/caisse`);
  return <AuditLog />;
}
