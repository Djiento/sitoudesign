import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Globe2, LockKeyhole, ShieldCheck } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { getStaffSession } from "@/lib/admin-auth";

export const instant = false;

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";
  const staff = await getStaffSession();
  const roleLabel = staff?.role === "ADMIN"
    ? en ? "Administrator" : "Administrateur"
    : staff?.role === "MANAGER"
      ? "Manager"
      : staff?.role === "CASHIER"
        ? en ? "Cashier" : "Caissier"
        : en ? "Role unavailable" : "Rôle indisponible";

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">{en ? "WORKSPACE" : "ESPACE DE TRAVAIL"}</span>
          <h1>{en ? "Settings" : "Paramètres"}</h1>
          <p>{en ? "Review how your admin workspace is configured." : "Consultez la configuration de votre espace d’administration."}</p>
        </div>
      </header>
      <section className="admin-settings-section" aria-labelledby="admin-account-heading">
        <div className="admin-settings-section-heading">
          <h2 id="admin-account-heading">{en ? "Your account" : "Votre compte"}</h2>
          <p>{en ? "Personal details and access to your workspace." : "Vos informations et l’accès à votre espace."}</p>
        </div>
        <div className="admin-settings-grid">
          <article className="admin-panel admin-setting-card">
            <span className="admin-setting-icon"><ShieldCheck size={20} /></span>
            <div>
              <h2>{staff?.fullName ?? (en ? "Signed-in account" : "Compte connecté")}</h2>
              <p>{staff?.email}</p>
            </div>
            <span className="admin-status-pill is-active">{roleLabel}</span>
          </article>
          <article className="admin-panel admin-setting-card">
            <span className="admin-setting-icon is-blue"><LockKeyhole size={20} /></span>
            <div>
              <h2>{en ? "Account security" : "Sécurité du compte"}</h2>
              <p>{en ? "Change your password without sharing it with anyone." : "Modifiez votre mot de passe sans le communiquer à qui que ce soit."}</p>
            </div>
            <Link className="admin-inline-link" href={`/${locale}/changer-mot-de-passe`}>
              {en ? "Change password" : "Changer le mot de passe"} <ArrowUpRight size={15} />
            </Link>
          </article>
        </div>
      </section>
      <section className="admin-settings-section" aria-labelledby="admin-preferences-heading">
        <div className="admin-settings-section-heading">
          <h2 id="admin-preferences-heading">{en ? "Workspace preferences" : "Préférences de l’espace"}</h2>
          <p>{en ? "Display choices that apply across the admin workspace." : "Préférences d’affichage appliquées à tout l’espace d’administration."}</p>
        </div>
        <div className="admin-settings-grid">
          <article className="admin-panel admin-setting-card">
            <span className="admin-setting-icon is-orange"><ShieldCheck size={20} /></span>
            <div>
              <h2>{en ? "Color theme" : "Thème de couleur"}</h2>
              <p>{en ? "Choose light, dark or system appearance from the theme selector in the top bar. Your choice is saved on this device." : "Choisissez le mode clair, sombre ou système avec le sélecteur de thème dans la barre supérieure. Votre choix est conservé sur cet appareil."}</p>
            </div>
          </article>
        </div>
      </section>
      <section className="admin-settings-section" aria-labelledby="admin-public-heading">
        <div className="admin-settings-section-heading">
          <h2 id="admin-public-heading">{en ? "Public website" : "Site public"}</h2>
          <p>{en ? "Review the content visitors can see." : "Vérifiez les contenus visibles par vos visiteurs."}</p>
        </div>
        <div className="admin-settings-grid">
          <article className="admin-panel admin-setting-card">
            <span className="admin-setting-icon is-orange"><Globe2 size={20} /></span>
            <div>
              <h2>{en ? "Visit the website" : "Visiter le site"}</h2>
              <p>{en ? "Open your public website to review the changes made from the admin workspace." : "Ouvrez votre site public pour vérifier les modifications effectuées depuis l’administration."}</p>
            </div>
            <Link className="admin-inline-link" href={`/${locale}`}>
              {en ? "Open website" : "Voir le site"} <ArrowUpRight size={15} />
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
