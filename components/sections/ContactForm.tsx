
"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

type FormState = "idle" | "sending" | "success" | "error";

export default function ContactForm({
  locale,
  quote = false,
}: {
  locale: Locale;
  quote?: boolean;
}) {
  const en = locale === "en";
  const [state, setState] = useState<FormState>("idle");
  const [reference, setReference] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setErrorMessage("");
    setReference("");

    const form = event.currentTarget;
    const values = new FormData(form);

    const payload = {
      fullName: String(values.get("name") ?? ""),
      email: String(values.get("email") ?? ""),
      phone: String(values.get("phone") ?? ""),
      company: String(values.get("company") ?? ""),
      service: String(values.get("service") ?? (quote ? "" : "contact")),
      quantity: values.get("quantity")
        ? Number(values.get("quantity"))
        : null,
      deadline: String(values.get("deadline") ?? ""),
      message: String(values.get("message") ?? ""),
      locale,
    };

    if (!quote) {
      payload.service = "contact";
      payload.message = `${en ? "Contact message" : "Message de contact"}\n\n${payload.message}`;
    }

    try {
      if (quote) {
        const response = await fetch("/api/devis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          const details = result.details as Record<string, string[]> | undefined;
          const firstError = details ? Object.values(details).flat()[0] : undefined;
          throw new Error(firstError ?? (en ? "Unable to submit your request." : "Impossible d'envoyer la demande."));
        }

        setReference(result.reference);
        setState("success");
        form.reset();
      } else {
        // L'API de contact sera ajoutée dans le bloc notifications.
        setState("error");
        setErrorMessage(
          en
            ? "The contact endpoint is not connected yet. Please use the phone number below."
            : "Le service de contact n'est pas encore raccordé. Utilise le numéro indiqué ci-dessous.",
        );
      }
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : en ? "An unexpected error occurred." : "Une erreur inattendue est survenue.",
      );
    }
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      {state === "success" && (
        <div className="alert alert-success mb-5">
          <div>
            <strong>{en ? "Request received!" : "Demande enregistrée !"}</strong>
            <p>
              {en ? "Your reference is:" : "Ta référence est :"}{" "}
              <strong>{reference}</strong>
            </p>
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="alert alert-error mb-5">
          {errorMessage}
        </div>
      )}

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="name">{en ? "Full name" : "Nom complet"} *</label>
          <input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
        </div>
        <div className="form-field">
          <label htmlFor="email">E-mail *</label>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
        </div>
        <div className="form-field">
          <label htmlFor="phone">{en ? "Phone number" : "Téléphone"}</label>
          <input id="phone" name="phone" maxLength={40} autoComplete="tel" />
        </div>
        {quote && (
          <div className="form-field">
            <label htmlFor="company">{en ? "Company" : "Entreprise"}</label>
            <input id="company" name="company" maxLength={160} autoComplete="organization" />
          </div>
        )}
        {quote && (
          <>
            <div className="form-field">
              <label htmlFor="service">{en ? "Service" : "Type de prestation"} *</label>
              <select id="service" name="service" required defaultValue="">
                <option value="" disabled>{en ? "Choose a service" : "Choisir une prestation"}</option>
                <option value="impression">{en ? "Printing" : "Impression"}</option>
                <option value="signaletique">Signalétique / Signage</option>
                <option value="textile">Textile</option>
                <option value="objets">{en ? "Custom products" : "Objets personnalisés"}</option>
                <option value="graphisme">{en ? "Graphic design" : "Création graphique"}</option>
                <option value="web">Web</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="quantity">{en ? "Estimated quantity" : "Quantité estimée"}</label>
              <input id="quantity" name="quantity" type="number" min="1" max="10000000" />
            </div>
            <div className="form-field">
              <label htmlFor="deadline">{en ? "Desired deadline" : "Délai souhaité"}</label>
              <input id="deadline" name="deadline" type="date" />
            </div>
          </>
        )}
        <div className="form-field full">
          <label htmlFor="message">{en ? "Tell us about your project" : "Décris ton projet"} *</label>
          <textarea id="message" name="message" required minLength={10} maxLength={5000} />
        </div>
        <div className="form-field full">
          <button className="btn btn-primary" type="submit" disabled={state === "sending"}>
            {state === "sending"
              ? en ? "Sending…" : "Envoi en cours…"
              : quote
                ? en ? "Send quote request" : "Envoyer la demande de devis"
                : en ? "Send message" : "Envoyer le message"}
          </button>
        </div>
      </div>
    </form>
  );
}
