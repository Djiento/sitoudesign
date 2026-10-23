"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, LoaderCircle, Mail, Phone, RefreshCw, Save, Search, StickyNote } from "lucide-react";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";

type QuoteStatus = "NEW" | "IN_PROGRESS" | "QUOTED" | "ACCEPTED" | "REJECTED" | "CLOSED";
type Quote = {
  id: string;
  reference: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  service: string;
  quantity: number | null;
  deadline: string | null;
  message: string;
  locale: string;
  status: QuoteStatus;
  internalNote: string | null;
  createdAt: string;
};

const statusValues: QuoteStatus[] = ["NEW", "IN_PROGRESS", "QUOTED", "ACCEPTED", "REJECTED", "CLOSED"];

export default function QuoteManager({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const labels: Record<QuoteStatus, string> = {
    NEW: en ? "New" : "Nouvelle",
    IN_PROGRESS: en ? "In progress" : "En cours",
    QUOTED: en ? "Quote sent" : "Devis envoyé",
    ACCEPTED: en ? "Accepted" : "Acceptée",
    REJECTED: en ? "Declined" : "Refusée",
    CLOSED: en ? "Closed" : "Clôturée",
  };

  const loadQuotes = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/devis", { cache: "no-store" });
      const data: { quotes?: Quote[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not load requests." : "Impossible de charger les demandes."));
      if (!Array.isArray(data.quotes)) throw new Error(en ? "The requests response is invalid." : "La réponse des demandes est invalide.");
      setQuotes(data.quotes);
      setNotes(Object.fromEntries(data.quotes.map((quote) => [quote.id, quote.internalNote ?? ""])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not load requests." : "Impossible de charger les demandes."));
    } finally {
      setLoading(false);
    }
  }, [en]);

  // The initial list is fetched from the protected admin API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadQuotes(); }, [loadQuotes]);
  const refreshQuotes = () => {
    setLoading(true);
    void loadQuotes();
  };

  const visibleQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      const matchesStatus = statusFilter === "ALL" || quote.status === statusFilter;
      const matchesQuery = !query || [
        quote.fullName, quote.email, quote.company ?? "", quote.reference, quote.service,
      ].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [quotes, search, statusFilter]);

  const updateQuote = async (quote: Quote, changes: { status?: QuoteStatus; internalNote?: string | null }) => {
    setSavingId(quote.id);
    try {
      const response = await fetch(`/api/admin/devis/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data: { quote?: Quote; error?: string } = await response.json();
      const updatedQuote = data.quote;
      if (!response.ok || !updatedQuote) throw new Error(data.error || (en ? "Could not update request." : "Impossible de modifier la demande."));
      setQuotes((current) => current.map((item) => item.id === quote.id ? updatedQuote : item));
      if (changes.internalNote !== undefined) toast.success(en ? "Internal note saved." : "Note interne enregistrée.");
      else toast.success(en ? "Request status updated." : "Statut de la demande mis à jour.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not update request." : "Impossible de modifier la demande."));
    } finally {
      setSavingId(null);
    }
  };

  const formatDate = (value: string) => new Intl.DateTimeFormat(en ? "en" : "fr", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">{en ? "CUSTOMER RELATIONSHIP" : "RELATION CLIENT"}</span>
          <h1>{en ? "Quote requests" : "Demandes de devis"}</h1>
          <p>{en ? "Review requests, track their progress and keep private notes." : "Consultez les demandes, suivez leur avancement et gardez des notes privées."}</p>
        </div>
        <button type="button" className="admin-quiet-button" onClick={refreshQuotes} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} /> {en ? "Refresh" : "Actualiser"}
        </button>
      </header>

      <div className="admin-quote-stats">
        {(["NEW", "IN_PROGRESS", "QUOTED", "ACCEPTED"] as const).map((status) => (
          <button type="button" key={status} className={`admin-quote-stat${statusFilter === status ? " is-selected" : ""}`} onClick={() => setStatusFilter(statusFilter === status ? "ALL" : status)}>
            <span>{labels[status]}</span>
            <strong>{quotes.filter((quote) => quote.status === status).length}</strong>
          </button>
        ))}
        <button type="button" className={`admin-quote-stat${statusFilter === "ALL" ? " is-selected" : ""}`} onClick={() => setStatusFilter("ALL")}>
          <span>{en ? "All requests" : "Toutes les demandes"}</span>
          <strong>{quotes.length}</strong>
        </button>
      </div>

      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={en ? "Search name, email or reference…" : "Rechercher nom, email ou référence…"} />
          </label>
          <label className="admin-filter">
            <span>{en ? "Status" : "Statut"}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{en ? "All statuses" : "Tous les statuts"}</option>
              {statusValues.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="admin-empty-state"><LoaderCircle className="animate-spin" size={24} />{en ? "Loading requests…" : "Chargement des demandes…"}</div>
        ) : visibleQuotes.length === 0 ? (
          <div className="admin-empty-state"><ClipboardList size={27} /><strong>{en ? "No requests found" : "Aucune demande trouvée"}</strong><span>{en ? "New quote requests will appear here." : "Les nouvelles demandes de devis apparaîtront ici."}</span></div>
        ) : (
          <div className="admin-quote-list">
            {visibleQuotes.map((quote) => (
              <article className="admin-quote-card" key={quote.id}>
                <div className="admin-quote-card-top">
                  <div>
                    <span className="admin-quote-reference">#{quote.reference.slice(-8).toUpperCase()}</span>
                    <h2>{quote.fullName}</h2>
                    <p>{quote.company || quote.service} <span>·</span> {formatDate(quote.createdAt)}</p>
                  </div>
                  <label className="admin-status-select">
                    <span className="sr-only">{en ? "Request status" : "Statut de la demande"}</span>
                    <select value={quote.status} disabled={savingId === quote.id} onChange={(event) => void updateQuote(quote, { status: event.target.value as QuoteStatus })}>
                      {statusValues.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
                    </select>
                  </label>
                </div>
                <div className="admin-quote-contact">
                  <a href={`mailto:${quote.email}`}><Mail size={15} />{quote.email}</a>
                  {quote.phone && <a href={`tel:${quote.phone}`}><Phone size={15} />{quote.phone}</a>}
                </div>
                <div className="admin-quote-meta">
                  <span><strong>{en ? "Service" : "Prestation"}</strong>{quote.service}</span>
                  {quote.quantity !== null && <span><strong>{en ? "Quantity" : "Quantité"}</strong>{quote.quantity.toLocaleString(en ? "en" : "fr")}</span>}
                  {quote.deadline && <span><strong>{en ? "Deadline" : "Échéance"}</strong>{new Intl.DateTimeFormat(en ? "en" : "fr", { dateStyle: "medium" }).format(new Date(quote.deadline))}</span>}
                </div>
                <p className="admin-quote-message">{quote.message}</p>
                <details className="admin-note-details">
                  <summary><StickyNote size={16} />{quote.internalNote ? (en ? "Edit internal note" : "Modifier la note interne") : (en ? "Add an internal note" : "Ajouter une note interne")}</summary>
                  <div className="admin-note-editor">
                    <textarea maxLength={5000} rows={3} value={notes[quote.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [quote.id]: event.target.value }))} placeholder={en ? "Private notes, visible to admins only…" : "Note privée, visible uniquement par les administrateurs…"} />
                    <button type="button" className="admin-quiet-button" disabled={savingId === quote.id} onClick={() => void updateQuote(quote, { internalNote: notes[quote.id]?.trim() || null })}>
                      {savingId === quote.id ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
                      {en ? "Save note" : "Enregistrer la note"}
                    </button>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
