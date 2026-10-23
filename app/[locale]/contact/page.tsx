
import { notFound } from "next/navigation";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import ContactForm from "@/components/sections/ContactForm";
import { isLocale } from "@/lib/i18n";

export const instant = false;

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";

  return (
    <div className="contact-page">
      <section className="contact-layout">
        <div className="contact-intro">
          <span className="eyebrow">{en ? "Get in touch" : "Prenons contact"}</span>
          <h1>{en ? "Let’s make your next idea real." : "Donnons vie à votre prochain projet."}</h1>
          <p>
            {en
              ? "Tell us what you have in mind. We’ll get back to you to find the right solution."
              : "Parlez-nous de votre idée. Nous vous répondrons pour trouver ensemble la bonne solution."}
          </p>

          <div className="contact-details">
            <a className="contact-detail" href="tel:+2290166575767">
              <span className="contact-detail-icon"><Phone size={19} aria-hidden="true" /></span>
              <span>
                <small>{en ? "Call us" : "Appelez-nous"}</small>
                <strong>+229 01 66 57 57 67</strong>
              </span>
              <ArrowUpRight className="contact-detail-arrow" size={18} aria-hidden="true" />
            </a>
            <div className="contact-detail">
              <span className="contact-detail-icon"><Mail size={19} aria-hidden="true" /></span>
              <span>
                <small>{en ? "Write to us" : "Écrivez-nous"}</small>
                <strong>{en ? "Use the form" : "Via le formulaire"}</strong>
              </span>
            </div>
            <div className="contact-detail">
              <span className="contact-detail-icon"><MapPin size={19} aria-hidden="true" /></span>
              <span>
                <small>{en ? "Our approach" : "Notre priorité"}</small>
                <strong>{en ? "Personalized support" : "Un accompagnement sur mesure"}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="contact-form-wrap">
          <div className="contact-form-heading">
            <span>{en ? "Start a conversation" : "Votre projet commence ici"}</span>
            <h2>{en ? "Send us a message" : "Parlons de votre projet"}</h2>
            <p>
              {en
                ? "Fill in the details and our team will be happy to help."
                : "Quelques informations suffisent pour que notre équipe puisse vous aider."}
            </p>
          </div>
          <ContactForm locale={locale} />
        </div>
      </section>
    </div>
  );
}
