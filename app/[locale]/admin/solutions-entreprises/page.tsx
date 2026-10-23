import { notFound } from "next/navigation";
import BusinessSolutionManager from "@/components/admin/BusinessSolutionManager";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function AdminBusinessSolutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BusinessSolutionManager locale={locale} />;
}
