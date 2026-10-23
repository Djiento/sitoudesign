import { notFound } from "next/navigation";
import ServiceManager from "@/components/admin/ServiceManager";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function AdminServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ServiceManager locale={locale} />;
}
