import { notFound, redirect } from "next/navigation";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import { getStaffSession } from "@/lib/admin-auth";

export const instant = false;

export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "fr" && locale !== "en") notFound();
  const staff = await getStaffSession();
  if (!staff) redirect(`/${locale}/connexion-admin`);
  if (!staff.mustChangePassword) redirect(`/${locale}/admin`);
  return <ChangePasswordForm />;
}
