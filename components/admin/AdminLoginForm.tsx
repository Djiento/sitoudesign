
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";

export default function AdminLoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const en = locale === "en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Connexion impossible.");
        return;
      }

      const locale = window.location.pathname.split("/")[1];
      const nextPath = data.mustChangePassword
        ? `/${locale === "en" ? "en" : "fr"}/changer-mot-de-passe`
        : `/${locale === "en" ? "en" : "fr"}/admin`;
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Erreur réseau. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-brand" aria-label={en ? "Sitou Design administration" : "Administration Sitou Design"}>
        <div className="admin-login-brand-inner">
          <a className="admin-login-logo" href={`/${locale}`} aria-label={en ? "Back to Sitou Design website" : "Retour au site Sitou Design"}>
            <Image src="/logo.png" alt="Sitou Design" width={190} height={72} priority />
          </a>
          <div className="admin-login-brand-copy">
            <span className="admin-login-kicker">
              <span aria-hidden="true" />
              {en ? "Your creative workspace" : "Votre espace de création"}
            </span>
            <h2>
              {en ? "Ideas, made" : "Les idées prennent"}
              <br />
              <span>{en ? "beautifully real." : "forme ici."}</span>
            </h2>
            <p>
              {en
                ? "A clear view of your business, your projects and everything you create."
                : "Retrouvez en un seul endroit vos projets, votre activité et tout ce que vous créez."}
            </p>
          </div>
          <div className="admin-login-brand-foot">
            <span><ShieldCheck size={17} aria-hidden="true" /> {en ? "Private and secure access" : "Accès privé et sécurisé"}</span>
            <span>© Sitou Design</span>
          </div>
        </div>
        <div className="admin-login-art" aria-hidden="true">
          <span className="admin-login-art-ring admin-login-art-ring-one" />
          <span className="admin-login-art-ring admin-login-art-ring-two" />
          <span className="admin-login-art-card admin-login-art-card-one" />
          <span className="admin-login-art-card admin-login-art-card-two" />
          <span className="admin-login-art-swatch admin-login-art-swatch-blue" />
          <span className="admin-login-art-swatch admin-login-art-swatch-orange" />
        </div>
      </section>

      <section className="admin-login-content">
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-login-mobile-logo">
            <Image src="/logo.png" alt="Sitou Design" width={166} height={64} priority />
          </div>
          <div className="admin-login-heading">
            <span className="admin-login-heading-icon"><LockKeyhole size={19} aria-hidden="true" /></span>
            <p>{en ? "Welcome back" : "Bienvenue"}</p>
            <h1>{en ? "Sign in to your space" : "Connectez-vous à votre espace"}</h1>
            <span className="admin-login-subtitle">
              {en ? "Enter your details to continue." : "Saisissez vos identifiants pour continuer."}
            </span>
          </div>

          <div className="admin-login-fields">
            <label className="admin-login-field" htmlFor="admin-email">
              <span>{en ? "Email address" : "Adresse e-mail"}</span>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder={en ? "you@company.com" : "vous@entreprise.com"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
              />
            </label>

            <div className="admin-login-field">
              <label htmlFor="admin-password">{en ? "Password" : "Mot de passe"}</label>
              <span className="admin-login-password">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  maxLength={1024}
                />
                <button
                  className="admin-login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword
                    ? en ? "Hide password" : "Masquer le mot de passe"
                    : en ? "Show password" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </div>
          </div>

          {error && <p role="alert" className="admin-login-error">{error}</p>}

          <button className="admin-login-submit" type="submit" disabled={loading}>
            <span>{loading ? en ? "Signing in…" : "Connexion en cours…" : en ? "Sign in" : "Se connecter"}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>

          <p className="admin-login-security">
            <ShieldCheck size={16} aria-hidden="true" />
            {en ? "Your connection is protected." : "Votre connexion est protégée."}
          </p>
        </form>
        <p className="admin-login-copyright">© Sitou Design · {en ? "All rights reserved" : "Tous droits réservés"}</p>
      </section>
    </main>
  );
}