
import { notFound } from "next/navigation";
import ContactForm from "@/components/sections/ContactForm";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function QuotePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="eyebrow">{en ? "Your project" : "Votre projet"}</span>
          <h1>{en ? "Request a tailored quote." : "Recevez un devis adapté à votre projet."}</h1>
          <p>{en ? "Share the details of your project so we can understand your needs." : "Précise ta demande pour nous permettre de comprendre tes besoins et de préparer une proposition."}</p>
        </div>
      </section>
      <section className="content-section">
        <div className="content-wrap">
          <ContactForm locale={locale} quote />
        </div>
      </section>
    </>
  );
}