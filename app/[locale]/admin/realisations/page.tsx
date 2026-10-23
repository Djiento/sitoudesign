import { notFound } from "next/navigation";
import PortfolioManager from "@/components/admin/PortfolioManager";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function AdminRealisationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <PortfolioManager locale={locale} />;
}