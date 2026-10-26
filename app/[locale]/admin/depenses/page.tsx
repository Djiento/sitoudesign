import { notFound } from "next/navigation";
import ExpensesManager from "@/components/admin/ExpensesManager";
import { getStaffSession } from "@/lib/admin-auth";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function ExpensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (!staff) notFound();

  return (
    <ExpensesManager
      locale={locale}
      role={staff.role}
      canApproveExpenses={staff.canApproveExpenses}
      canExportReports={staff.canExportReports}
    />
  );
}
