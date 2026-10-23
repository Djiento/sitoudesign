import { notFound } from "next/navigation";
import ArticleManager from "@/components/admin/ArticleManager";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function AdminArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ArticleManager locale={locale} />;
}
