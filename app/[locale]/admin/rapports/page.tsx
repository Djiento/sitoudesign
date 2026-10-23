import { notFound, redirect } from "next/navigation";
import ReportsManager from "@/components/admin/ReportsManager";
import { getStaffSession } from "@/lib/admin-auth";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (!staff) redirect(`/${locale}/connexion-admin`);
  if (staff.role !== "ADMIN" && !staff.canExportReports) redirect(`/${locale}/admin/caisse`);
  return <ReportsManager />;
}
