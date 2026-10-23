
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Menu } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n";

export default function SiteHeader({ locale }: { locale: Locale }) {
  const t = dictionaries[locale].nav;
  const otherLocale = locale === "fr" ? "en" : "fr";

  const links = [
    { href: `/${locale}/catalogue`, label: t.catalogue },
    { href: `/${locale}/realisations`, label: t.portfolio },
    { href: `/${locale}/services`, label: t.services },
    { href: `/${locale}/solutions-entreprises`, label: t.business },
    { href: `/${locale}/conseils`, label: t.advice },
  ];
  const menuLinks = [
    { href: `/${locale}`, label: t.home },
    ...links,
    { href: `/${locale}/contact`, label: t.contact },
  ];

  return (
    <header className="site-header">
      <div className="navbar site-navbar">
        <Link href={`/${locale}`} className="brand" aria-label="Sitou Design">
          <Image
            src="/logo.png"
            alt="Sitou Design"
            width={172}
            height={74}
            priority
            className="brand-logo"
          />
        </Link>

        <nav
          className="desktop-nav"
          aria-label={locale === "fr" ? "Navigation principale" : "Main navigation"}
        >
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link
            className="language-switch"
            href={`/${otherLocale}`}
            aria-label={locale === "fr" ? "Switch to English" : "Passer en français"}
          >
            {otherLocale.toUpperCase()}
          </Link>
          <Link className="btn btn-primary quote-button" href={`/${locale}/devis`}>
            {t.quote}
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
          <div className="dropdown dropdown-end mobile-menu">
            <button
              type="button"
              className="btn btn-ghost menu-trigger"
              aria-label={locale === "fr" ? "Ouvrir le menu" : "Open menu"}
            >
              <Menu aria-hidden="true" size={19} />
            </button>
            <ul className="menu dropdown-content mobile-dropdown">
              {menuLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li><Link href={`/${locale}/devis`}>{t.quote}</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
