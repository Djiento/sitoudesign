
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl"
      >
        <div className="card-body gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Sitou Design
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              Administration
            </h1>
            <p className="mt-1 text-sm opacity-70">
              Connecte-toi pour gérer le catalogue et les réalisations.
            </p>
          </div>

          <label className="form-control w-full">
            <span className="label-text mb-2">Adresse e-mail</span>
            <input
              className="input input-bordered w-full"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-2">Mot de passe</span>
            <input
              className="input input-bordered w-full"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              maxLength={1024}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          <button
            className="btn btn-primary mt-1 w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </div>
      </form>
    </main>
  );
}