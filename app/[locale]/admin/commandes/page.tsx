import { notFound, redirect } from "next/navigation";
import OrderManager from "@/components/admin/OrderManager";
import { getStaffSession } from "@/lib/admin-auth";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (!staff) redirect(`/${locale}/connexion-admin`);
  return <OrderManager locale={locale} role={staff.role} staffId={staff.userId ?? ""} />;
}
