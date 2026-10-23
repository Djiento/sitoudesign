
import { notFound } from "next/navigation";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import LocaleChrome from "@/components/layout/LocaleChrome";
import { isLocale, locales } from "@/lib/i18n";

export const instant = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) notFound();

  return (
    <LocaleChrome
      header={<SiteHeader locale={locale} />}
      footer={<SiteFooter locale={locale} />}
    >
      {children}
    </LocaleChrome>
  );
}
