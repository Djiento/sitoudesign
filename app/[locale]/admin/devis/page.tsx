
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import QuoteManager from "@/components/admin/QuoteManager";

export default async function AdminQuotesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <QuoteManager locale={locale} />;
}