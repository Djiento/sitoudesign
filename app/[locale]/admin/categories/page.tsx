import { notFound } from "next/navigation";
import CategoryManager from "@/components/admin/CategoryManager";
import { isLocale } from "@/lib/i18n";

export const instant = false;

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CategoriesPage({ params }: PageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <CategoryManager />;
}