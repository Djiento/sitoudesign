
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getStaffSession } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";

export const instant = false;

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale !== "fr" && locale !== "en") {
    redirect("/fr");
  }

  const staff = await getStaffSession();

  if (!staff) {
    redirect(`/${locale}/connexion-admin`);
  }

  if (staff.mustChangePassword) {
    redirect(`/${locale}/changer-mot-de-passe`);
  }

  return <AdminShell locale={locale} role={staff.role} canExportReports={staff.canExportReports} fullName={staff.fullName} email={staff.email}>{children}</AdminShell>;
}
