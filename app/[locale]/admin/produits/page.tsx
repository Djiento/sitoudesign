
import { notFound } from "next/navigation";
import ProductManager from "@/components/admin/ProductManager";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function AdminProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <ProductManager locale={locale} />;
}