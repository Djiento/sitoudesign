import { notFound, redirect } from "next/navigation";
import InventoryManager from "@/components/admin/InventoryManager";
import { getStaffSession } from "@/lib/admin-auth";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (!staff) redirect(`/${locale}/connexion-admin`);
  const orderParam = Array.isArray(query.orderId) ? query.orderId[0] : query.orderId;
  const initialOrderId = orderParam?.trim().slice(0, 120) || undefined;
  return <InventoryManager isAdmin={staff.role === "ADMIN" || staff.role === "MANAGER"} isCashier={staff.role === "CASHIER"} initialOrderId={initialOrderId} />;
}
