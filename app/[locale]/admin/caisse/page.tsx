import { notFound } from "next/navigation";
import CashRegisterManager from "@/components/admin/CashRegisterManager";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function CashRegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CashRegisterManager locale={locale} />;
}
