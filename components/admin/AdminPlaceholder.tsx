
import Link from "next/link";

export default function AdminPlaceholder({
  title,
  description,
  locale,
}: {
  title: string;
  description: string;
  locale: string;
}) {
  const en = locale === "en";

  return (
    <div>
      <span className="eyebrow">{en ? "Content management" : "Gestion des contenus"}</span>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: "12px 0" }}>{title}</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>{description}</p>
      <div className="card bg-base-100 shadow-sm" style={{ padding: 28, marginTop: 24 }}>
        <div className="placeholder-media">
          <strong>{en ? "Management interface" : "Interface de gestion"}</strong>
          <span>
            {en
              ? "The database structure is ready. This screen will be connected to protected CRUD operations after administrator authentication is configured."
              : "La structure des données est prête. Cet écran sera relié aux opérations de gestion protégées après la configuration de l'authentification administrateur."}
          </span>
        </div>
        <div className="hero-actions">
          <Link href={`/${locale}`} className="btn btn-outline">
            {en ? "View website" : "Voir le site"}
          </Link>
        </div>
      </div>
    </div>
  );
}