"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de modifier le mot de passe.");
      const locale = window.location.pathname.split("/")[1] === "en" ? "en" : "fr";
      router.replace(`/${locale}/admin/caisse`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
        <div className="card-body gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Sitou Design</p>
            <h1 className="mt-2 text-2xl font-bold">Sécurise ton compte</h1>
            <p className="mt-1 text-sm opacity-70">Choisis un mot de passe personnel d’au moins 12 caractères.</p>
          </div>
          <label className="form-control w-full">
            <span className="label-text mb-2">Nouveau mot de passe</span>
            <input
              className="input input-bordered w-full"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </button>
        </div>
      </form>
    </main>
  );
}
