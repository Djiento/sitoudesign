import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Phone } from "lucide-react";
import type { Locale } from "@/lib/i18n";

async function getCurrentYear() {
  "use cache";
  return new Date().getFullYear();
}

export default async function SiteFooter({
  locale,
}: {
  locale: Locale;
}) {
  const en = locale === "en";
  const year = await getCurrentYear();

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <Link href={`/${locale}`} className="brand footer-brand">
            <Image
              src="/logo.png"
              alt="Sitou Design"
              width={172}
              height={74}
              className="brand-logo footer-logo"
            />
          </Link>

          <p>
            {en
              ? "Ideas become visible. We create print and visual communication that makes your brand stand out."
              : "Les idées prennent forme. Nous créons des supports imprimés et visuels qui valorisent votre marque."}
          </p>
        </div>

        <div>
          <h3>{en ? "Explore" : "Explorer"}</h3>
          <Link href={`/${locale}/catalogue`}>Catalogue</Link>
          <Link href={`/${locale}/realisations`}>
            {en ? "Our work" : "Nos réalisations"}
          </Link>
        </div>

        <div>
          <h3>{en ? "Expertise" : "Expertises"}</h3>
          <Link href={`/${locale}/services`}>Services</Link>
          <Link href={`/${locale}/solutions-entreprises`}>
            {en ? "Business solutions" : "Solutions entreprises"}
          </Link>
          <Link href={`/${locale}/conseils`}>
            {en ? "Insights" : "Conseils"}
          </Link>
        </div>

        <div className="footer-contact-block">
          <h3>{en ? "Let's talk" : "Parlons de votre projet"}</h3>
          <Link className="footer-quote-link" href={`/${locale}/devis`}>
            {en ? "Request a quote" : "Demander un devis"}
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
          <Link href={`/${locale}/contact`}>
            {en ? "Contact our team" : "Contacter notre équipe"}
          </Link>
          <a className="footer-phone" href="tel:+2290166575767">
            <Phone aria-hidden="true" size={15} />
            +229 01 66 57 57 67
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {year} Sitou Design</span>
        <span>
          {en ? "Designed with purpose." : "Créé avec passion."}
        </span>
      </div>
    </footer>
  );
}