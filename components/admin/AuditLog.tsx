"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AdminPagination from "@/components/admin/AdminPagination";
import { ADMIN_PAGE_SIZES, type AdminPageSize } from "@/lib/admin-pagination";

type Event = {
  id: string; action: string; targetType: string; targetId: string; result: string;
  reason: string | null; details: unknown; occurredAt: string;
  actor: { fullName: string; email: string; role: string };
};

type Pagination = { page: number; pageSize: AdminPageSize; total: number; totalPages: number };
type AuditFilters = { page: number; pageSize: AdminPageSize; query: string; targetType: string; action: string };

function readFilters(): AuditFilters {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: ADMIN_PAGE_SIZES.includes(pageSize as AdminPageSize) ? pageSize as AdminPageSize : 25,
    query: params.get("q") ?? "",
    targetType: params.get("targetType") ?? "",
    action: params.get("action") ?? "",
  };
}

function updateUrl(updates: Partial<AuditFilters>, historyMode: "push" | "replace") {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    const param = key === "query" ? "q" : key;
    if (!value || (param === "page" && value === 1) || (param === "pageSize" && value === 25)) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, String(value));
    }
  }
  window.history[historyMode === "push" ? "pushState" : "replaceState"](null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function AuditLog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, pageSize: 25, query: "", targetType: "", action: "" });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const restoreFilters = () => setFilters(readFilters());
    restoreFilters();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialized(true);
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.query.trim()) params.set("q", filters.query.trim());
      if (filters.targetType) params.set("targetType", filters.targetType);
      if (filters.action) params.set("action", filters.action);

      fetch(`/api/admin/audit?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const data: { events?: Event[]; pagination?: Pagination; error?: string } = await response.json();
          if (!response.ok || !Array.isArray(data.events) || !data.pagination) {
            throw new Error(data.error || "Impossible de charger le journal.");
          }
          setEvents(data.events);
          setPagination(data.pagination);
          if (data.pagination.page !== filters.page) {
            setFilters((current) => ({ ...current, page: data.pagination!.page }));
            updateUrl({ page: data.pagination.page }, "replace");
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          toast.error(error instanceof Error ? error.message : "Impossible de charger le journal.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, initialized]);

  function changePage(page: number) {
    const nextPage = Math.max(1, Math.min(page, pagination.totalPages));
    setFilters((current) => ({ ...current, page: nextPage }));
    updateUrl({ page: nextPage }, "push");
  }

  function changePageSize(pageSize: AdminPageSize) {
    setFilters((current) => ({ ...current, page: 1, pageSize }));
    updateUrl({ page: 1, pageSize }, "push");
  }

  return (
    <div className="admin-content">
      <header className="admin-page-heading"><div><span className="admin-eyebrow">CONTRÔLE & TRAÇABILITÉ</span><h1>Journal d’audit</h1><p>Journal append-only : les opérateurs ne peuvent ni modifier ni supprimer ces événements.</p></div><span className="admin-stat-icon is-blue"><ShieldCheck size={20} /></span></header>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Événements sensibles</h2><p>Événements d’audit paginés, avec auteur, opération, résultat et motif.</p></div><input className="admin-audit-search" maxLength={200} value={filters.query} onChange={(event) => {
          const query = event.target.value;
          setFilters((current) => ({ ...current, page: 1, query }));
          updateUrl({ page: 1, query }, "replace");
        }} placeholder="Filtrer le journal…" aria-label="Filtrer le journal d’audit" /></div>
        {loading ? <div className="admin-empty-state"><LoaderCircle size={22} className="animate-spin" />Chargement du journal…</div> : (
          events.length ? <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Cible</th><th>Résultat</th><th>Motif</th><th>Détails</th></tr></thead><tbody>
            {events.map((event) => <tr key={event.id}><td>{new Date(event.occurredAt).toLocaleString("fr-FR")}</td><td>{event.actor.fullName}<small>{event.actor.email}</small></td><td>{event.action}</td><td>{event.targetType}<small>{event.targetId}</small></td><td>{event.result}</td><td>{event.reason || "—"}</td><td><code>{JSON.stringify(event.details ?? {})}</code></td></tr>)}
          </tbody></table></div> : <div className="admin-empty-state"><ShieldCheck size={22} /><strong>Aucun événement trouvé</strong><span>Essaie de modifier ta recherche ou tes filtres.</span></div>
        )}
        {!loading && <AdminPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />}
      </section>
    </div>
  );
}
