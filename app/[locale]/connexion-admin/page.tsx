
import { notFound } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const instant = false;

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale !== "fr" && locale !== "en") {
    notFound();
  }

  return <AdminLoginForm locale={locale} />;
}
