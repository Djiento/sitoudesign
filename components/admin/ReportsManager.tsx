"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, Banknote, BarChart3, CalendarDays, CircleAlert, LoaderCircle, PackageCheck, Printer, ReceiptText, RefreshCw, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

type Report = {
  period: { from: string; to: string };
  filters: { userId: string; category: string; module: string };
  users: { id: string; fullName: string }[];
  summary: {
    salesCount: number;
    salesTotal: number;
    invoicedSalesTotal: number;
    counterSalesTotal: number;
    counterSalesCount: number;
    averageSale: number;
    payments: number;
    refunds: number;
    expenses: number;
    netCash: number;
    cashVariance: number;
    closedSessionCount: number;
    openSessionCount: number;
    stockMovementCount: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  salesByCategory: Record<string, number>;
  salesByCashier: { name: string; amount: number; count: number }[];
  expensesByCategory: Record<string, number>;
  dailyActivity: { date: string; sales: number; payments: number; expenses: number }[];
  orders: {
    id: string;
    orderNumber: string;
    category: string;
    totalAmount: number;
    createdAt: string;
    customerName: string;
    createdBy: { fullName: string };
  }[];
  expenses: {
    id: string;
    amount: number;
    occurredAt: string;
    expenseCategory: string | null;
    reason: string | null;
    actor: { fullName: string };
    register: { name: string };
  }[];
  byPaymentMethod: Record<string, number>;
  closedSessions: {
    id: string;
    register: { name: string };
    openedBy: { fullName: string };
    closedAt: string | null;
    variance: number | string | null;
  }[];
  openSessions: {
    id: string;
    openingFloat: number;
    openedAt: string;
    register: { name: string };
    openedBy: { fullName: string };
  }[];
  stockMovements: {
    id: string;
    type: string;
    quantity: number | string;
    reason: string;
    createdAt: string;
    actor: { fullName: string };
    item: { sku: string; name: string } | null;
    productVariant: { sku: string; color: string; size: string; product: { nameFr: string } } | null;
    order: { orderNumber: string } | null;
  }[];
  auditEvents: {
    id: string;
    action: string;
    targetType: string;
    result: string;
    occurredAt: string;
    actor: { fullName: string };
  }[];
  lowStock: { sku: string; name: string; available: number; unit: string }[];
};
type ReportFilters = { from: string; to: string; userId?: string; category?: string; module?: string };
type ReportPrintType = "GENERAL" | "SALES" | "EXPENSES" | "CASH" | "STOCK" | "LOW_STOCK" | "USERS";

const money = (value: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
}).format(value);

const initialPeriod = () => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return { from: `${today.slice(0, 8)}01`, to: today };
};

export default function ReportsManager() {
  const [period, setPeriod] = useState(initialPeriod);
  const [userId, setUserId] = useState("");
  const [category, setCategory] = useState("");
  const [module, setModule] = useState("ALL");
  const [printType, setPrintType] = useState<ReportPrintType>("GENERAL");
  const [report, setReport] = useState<Report | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const loadReport = useCallback(async (filters: ReportFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: filters.from, to: filters.to });
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.category) params.set("category", filters.category);
      if (filters.module) params.set("module", filters.module);
      const response = await fetch(`/api/admin/rapports?${params}`, { cache: "no-store" });
      const data: Report & { error?: string } = await response.json();
      if (!response.ok || !data.summary) throw new Error(data.error || "Impossible de charger le rapport.");
      setReport(data);
      setGeneratedAt(new Date().toLocaleString("fr-FR"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger le rapport.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the first report for the selected default month.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReport(initialPeriod());
  }, [loadReport]);

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadReport({ ...period, userId, category, module });
  }

  async function printReport() {
    if (!report) return;
    setPrinting(true);
    try {
      const response = await fetch("/api/admin/rapports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...report.period, ...report.filters, reportType: printType }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de journaliser l’export.");
      window.print();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’imprimer le rapport.");
    } finally {
      setPrinting(false);
    }
  }

  const categories: Record<string, string> = {
    GRAPHIC_DESIGN: "Graphisme",
    PRINTING: "Impression",
    ADVERTISING: "Supports publicitaires",
    OTHER: "Autres prestations",
  };
  const paymentMethods: Record<string, string> = {
    CASH: "Espèces",
    MOBILE_MONEY: "Mobile Money",
    BANK_TRANSFER: "Virement bancaire",
    OTHER: "Autre",
  };
  const maxDailyAmount = Math.max(1, ...((report?.dailyActivity ?? []).flatMap((day) => [day.sales, day.payments, day.expenses])));
  const maxCategorySales = Math.max(1, ...Object.values(report?.salesByCategory ?? {}));
  const maxCashierSales = Math.max(1, ...(report?.salesByCashier ?? []).map((cashier) => cashier.amount));
  const maxExpenseCategory = Math.max(1, ...Object.values(report?.expensesByCategory ?? {}));

  return (
    <div className="admin-content admin-report-page" data-print-type={printType}>
      <header className="admin-page-heading admin-report-controls">
        <div><span className="admin-eyebrow">SUPERVISION · RAPPORTS</span><h1>Rapport d’activité</h1><p>Les ventes facturées, les encaissements et les dépenses sont présentés séparément.</p></div>
        <div className="admin-form-actions">
          <label className="admin-report-type">Rapport à exporter
            <select value={printType} onChange={(event) => setPrintType(event.target.value as ReportPrintType)}>
              <option value="GENERAL">Rapport général</option>
              <option value="SALES">Ventes</option>
              <option value="EXPENSES">Dépenses</option>
              <option value="CASH">Caisse journalière</option>
              <option value="STOCK">Mouvements et état du stock</option>
              <option value="LOW_STOCK">Ruptures et stock faible</option>
              <option value="USERS">Activité des utilisateurs</option>
            </select>
          </label>
          <button type="button" className="admin-primary-button" disabled={!report || printing} onClick={() => void printReport()}>
            {printing ? <LoaderCircle size={17} className="animate-spin" /> : <Printer size={17} />}
            Imprimer / enregistrer en PDF
          </button>
        </div>
      </header>

      <form className="admin-panel admin-report-filter" onSubmit={(event) => void submitFilters(event)}>
        <label>Du<input type="date" required value={period.from} max={period.to} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} /></label>
        <label>Au<input type="date" required value={period.to} min={period.from} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} /></label>
        {report?.users.length ? <label>Utilisateur<select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Tous les utilisateurs</option>{report.users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label> : null}
        <label>Catégorie de vente<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Toutes les catégories</option><option value="GRAPHIC_DESIGN">Graphisme</option><option value="PRINTING">Impression</option><option value="ADVERTISING">Supports publicitaires</option><option value="OTHER">Autres prestations</option></select></label>
        <label>Module du journal<select value={module} onChange={(event) => setModule(event.target.value)}><option value="ALL">Tous les modules</option><option value="SALES">Ventes</option><option value="CASH">Caisse</option><option value="STOCK">Stock</option><option value="USERS">Utilisateurs</option><option value="CONTENT">Contenu du site</option></select></label>
        <button type="submit" className="admin-quiet-button" disabled={loading}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />} Appliquer</button>
      </form>

      <div className="admin-report-print-heading">
        <span>SITOU DESIGN · {printType === "GENERAL" ? "Rapport général d’activité" : printType === "LOW_STOCK" ? "Rapport des ruptures et stocks faibles" : `Rapport ${printType.toLowerCase()}`} · Généré le {generatedAt ?? "—"}</span>
        {report && <strong>Période : {report.period.from} au {report.period.to}{report.filters.category ? ` · Catégorie : ${categories[report.filters.category] ?? report.filters.category}` : ""}</strong>}
      </div>

      {loading && !report ? <div className="admin-empty-state"><LoaderCircle className="animate-spin" />Chargement du rapport…</div> : report ? (
        <>
          <section className="admin-report-kpis" aria-label="Indicateurs de gestion">
            <article className="admin-report-kpi is-blue" data-report-group="SALES"><span className="admin-report-kpi-icon"><TrendingUp size={19} /></span><span>Ventes enregistrées</span><strong>{money(report.summary.salesTotal)}</strong><small>{report.summary.salesCount} ventes · factures {money(report.summary.invoicedSalesTotal)} · comptoir {money(report.summary.counterSalesTotal)}</small></article>
            <article className="admin-report-kpi is-green" data-report-group="CASH"><span className="admin-report-kpi-icon"><Banknote size={19} /></span><span>Encaissements</span><strong>{money(report.summary.payments)}</strong><small>Paiements validés, tous modes confondus</small></article>
            <article className="admin-report-kpi is-violet" data-report-group="CASH"><span className="admin-report-kpi-icon"><ArrowUpRight size={19} /></span><span>Flux net de caisse</span><strong>{money(report.summary.netCash)}</strong><small>Encaissements − remboursements − dépenses</small></article>
            <article className="admin-report-kpi is-orange" data-report-group="EXPENSES CASH"><span className="admin-report-kpi-icon"><ArrowDownRight size={19} /></span><span>Dépenses</span><strong>{money(report.summary.expenses)}</strong><small>{money(report.summary.refunds)} de remboursements déduits séparément</small></article>
            <article className="admin-report-kpi is-cyan" data-report-group="SALES"><span className="admin-report-kpi-icon"><ReceiptText size={19} /></span><span>Panier moyen</span><strong>{money(report.summary.averageSale)}</strong><small>Sur {report.summary.salesCount} ventes, factures et comptoir</small></article>
            <article className={`admin-report-kpi ${report.summary.outOfStockCount ? "is-red" : "is-gold"}`} data-report-group="STOCK LOW_STOCK"><span className="admin-report-kpi-icon"><CircleAlert size={19} /></span><span>Alertes de stock</span><strong>{report.summary.lowStockCount}</strong><small>{report.summary.outOfStockCount} en rupture · seuil défini sur chaque article</small></article>
          </section>

          <section className="admin-panel admin-report-trend" data-report-group="SALES CASH EXPENSES">
            <div className="admin-panel-heading"><div><span className="admin-eyebrow">TENDANCE SUR LA PÉRIODE</span><h2>Activité quotidienne</h2><p>Ventes enregistrées, encaissements et dépenses par jour. Affichage des 31 dernières dates actives au maximum.</p></div><CalendarDays size={21} /></div>
            {report.dailyActivity.length ? <>
              <div className="admin-report-chart-legend"><span><i className="is-sales" />Ventes</span><span><i className="is-payments" />Encaissements</span><span><i className="is-expenses" />Dépenses</span></div>
              <div className="admin-report-daily-chart" role="img" aria-label="Graphique quotidien des ventes, encaissements et dépenses">
                {report.dailyActivity.map((day) => <div className="admin-report-day" key={day.date} title={`${day.date} · ventes ${money(day.sales)} · encaissements ${money(day.payments)} · dépenses ${money(day.expenses)}`}>
                  <div className="admin-report-day-bars">
                    <i className="is-sales" style={{ height: `${Math.max(2, day.sales / maxDailyAmount * 100)}%` }} />
                    <i className="is-payments" style={{ height: `${Math.max(2, day.payments / maxDailyAmount * 100)}%` }} />
                    <i className="is-expenses" style={{ height: `${Math.max(2, day.expenses / maxDailyAmount * 100)}%` }} />
                  </div>
                  <small>{new Date(`${day.date}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</small>
                </div>)}
              </div>
              <div className="admin-report-chart-scale"><span>Montants relatifs à la journée la plus élevée</span><span>{money(maxDailyAmount)}</span></div>
            </> : <p className="admin-empty-state">Aucune activité financière sur cette période.</p>}
          </section>

          <section className="admin-dashboard-recent-grid admin-report-tables">
            <article className="admin-panel" data-report-group="SALES">
              <div className="admin-panel-heading"><div><h2>Ventes par catégorie</h2><p>Factures et ventes comptoir, regroupées selon les données disponibles.</p></div><BarChart3 size={20} /></div>
              <div className="admin-report-bars">{Object.entries(report.salesByCategory).sort((a, b) => b[1] - a[1]).map(([key, amount]) => <div className="admin-report-bar-row" key={key}><div><span>{categories[key] ?? key}</span><strong>{money(amount)}</strong></div><span className="admin-report-bar-track"><i className="is-sales" style={{ width: `${amount / maxCategorySales * 100}%` }} /></span></div>)}
                {!Object.entries(report.salesByCategory).length && <p className="admin-empty-state">Aucune vente sur cette période.</p>}</div>
            </article>
            <article className="admin-panel" data-report-group="SALES CASH">
              <div className="admin-panel-heading"><div><h2>Performance par caissier</h2><p>Montants des ventes enregistrées et nombre d’opérations.</p></div><Users size={20} /></div>
              <div className="admin-report-bars">{report.salesByCashier.map((cashier) => <div className="admin-report-bar-row" key={cashier.name}><div><span>{cashier.name}<small>{cashier.count} vente(s)</small></span><strong>{money(cashier.amount)}</strong></div><span className="admin-report-bar-track"><i className="is-cashier" style={{ width: `${cashier.amount / maxCashierSales * 100}%` }} /></span></div>)}
                {!report.salesByCashier.length && <p className="admin-empty-state">Aucune vente attribuée sur cette période.</p>}</div>
            </article>
            <article className="admin-panel" data-report-group="CASH">
              <div className="admin-panel-heading"><div><h2>Encaissements par mode</h2><p>Opérations de paiement validées, remboursements exclus.</p></div><Banknote size={20} /></div>
              <div className="admin-report-rows">{Object.entries(report.byPaymentMethod).length ? Object.entries(report.byPaymentMethod).sort((a, b) => b[1] - a[1]).map(([key, amount]) => <div className="admin-report-row" key={key}><span>{paymentMethods[key] ?? key}</span><strong>{money(amount)}</strong></div>) : <p className="admin-empty-state">Aucun encaissement sur cette période.</p>}</div>
            </article>
            <article className="admin-panel" data-report-group="EXPENSES CASH">
              <div className="admin-panel-heading"><div><h2>Dépenses par catégorie</h2><p>Répartition des dépenses approuvées ou non soumises à approbation.</p></div><ArrowDownRight size={20} /></div>
              <div className="admin-report-bars">{Object.entries(report.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([key, amount]) => <div className="admin-report-bar-row" key={key}><div><span>{key}</span><strong>{money(amount)}</strong></div><span className="admin-report-bar-track"><i className="is-expenses" style={{ width: `${amount / maxExpenseCategory * 100}%` }} /></span></div>)}
                {!Object.entries(report.expensesByCategory).length && <p className="admin-empty-state">Aucune dépense validée.</p>}</div>
            </article>
            <article className="admin-panel" data-report-group="CASH">
              <div className="admin-panel-heading"><div><h2>Clôtures de caisse</h2><p>{report.summary.closedSessionCount} session(s) clôturée(s) · écart net cumulé {money(report.summary.cashVariance)}.</p></div><CircleAlert size={20} /></div>
              <div className="admin-report-rows">{report.closedSessions.length ? report.closedSessions.map((session) => <div className="admin-report-row" key={session.id}><span>{session.register.name}<small>{session.openedBy.fullName} · {session.closedAt ? new Date(session.closedAt).toLocaleString("fr-FR") : "date inconnue"}</small></span><strong>{money(Number(session.variance ?? 0))}</strong></div>) : <p className="admin-empty-state">Aucune clôture sur cette période.</p>}</div>
            </article>
            <article className="admin-panel" data-report-group="CASH">
              <div className="admin-panel-heading"><div><h2>Caisses actuellement ouvertes</h2><p>{report.summary.openSessionCount} session(s) ouverte(s) à l’instant de consultation.</p></div></div>
              <div className="admin-report-rows">{report.openSessions.length ? report.openSessions.map((session) => <div className="admin-report-row" key={session.id}><span>{session.register.name}<small>{session.openedBy.fullName} · ouverte le {new Date(session.openedAt).toLocaleString("fr-FR")}</small></span><strong>Fonds initial : {money(session.openingFloat)}</strong></div>) : <p className="admin-empty-state">Aucune caisse ouverte.</p>}</div>
            </article>
            <article className="admin-panel" data-report-group="STOCK LOW_STOCK">
              <div className="admin-panel-heading"><div><h2>Stock faible ou épuisé</h2><p>{report.summary.lowStockCount} alerte(s) dont {report.summary.outOfStockCount} rupture(s) · état actuel, sans valorisation d’achat.</p></div><PackageCheck size={20} /></div>
              <div className="admin-report-rows">{report.lowStock.length ? report.lowStock.map((item) => <div className="admin-report-row" key={`${item.sku}-${item.name}`}><span>{item.name}<small>{item.sku}</small></span><strong className={item.available <= 0 ? "is-stock-out" : ""}>{item.available.toLocaleString("fr-FR")} {item.unit}</strong></div>) : <p className="admin-empty-state">Aucune alerte de stock.</p>}</div>
            </article>
          </section>

          <section className="admin-panel" data-report-group="SALES">
            <div className="admin-panel-heading"><div><h2>Ventes et factures</h2><p>{report.orders.length} commande(s) créée(s) sur la période, non annulées.</p></div></div>
            <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Date</th><th>Commande</th><th>Client</th><th>Activité</th><th>Caissier / créateur</th><th className="is-number">Montant facturé</th></tr></thead><tbody>
              {report.orders.map((order) => <tr key={order.id}><td>{new Date(order.createdAt).toLocaleString("fr-FR")}</td><td>{order.orderNumber}</td><td>{order.customerName}</td><td>{categories[order.category] ?? order.category}</td><td>{order.createdBy.fullName}</td><td className="is-number">{money(order.totalAmount)}</td></tr>)}
              {!report.orders.length && <tr><td colSpan={6}>Aucune commande sur cette période.</td></tr>}
            </tbody></table></div>
          </section>

          <section className="admin-panel" data-report-group="EXPENSES CASH">
            <div className="admin-panel-heading"><div><h2>Détail des dépenses</h2><p>Seules les dépenses approuvées ou non soumises à approbation sont listées.</p></div></div>
            <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Date</th><th>Caisse</th><th>Catégorie</th><th>Motif</th><th>Utilisateur</th><th className="is-number">Montant</th></tr></thead><tbody>
              {report.expenses.map((expense) => <tr key={expense.id}><td>{new Date(expense.occurredAt).toLocaleString("fr-FR")}</td><td>{expense.register.name}</td><td>{expense.expenseCategory ?? "—"}</td><td>{expense.reason ?? "—"}</td><td>{expense.actor.fullName}</td><td className="is-number">{money(expense.amount)}</td></tr>)}
              {!report.expenses.length && <tr><td colSpan={6}>Aucune dépense validée sur cette période.</td></tr>}
            </tbody></table></div>
          </section>

          <section className="admin-panel" data-report-group="STOCK">
            <div className="admin-panel-heading"><div><h2>Mouvements de stock récents</h2><p>{report.summary.stockMovementCount} mouvement(s) sur la période · affichage des 12 derniers.</p></div></div>
            <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Date</th><th>Article / variante</th><th>Mouvement</th><th>Quantité</th><th>Commande</th><th>Utilisateur</th></tr></thead><tbody>
              {report.stockMovements.map((movement) => <tr key={movement.id}><td>{new Date(movement.createdAt).toLocaleString("fr-FR")}</td><td>{movement.item ? `${movement.item.sku} · ${movement.item.name}` : `${movement.productVariant?.sku ?? "Variante"} · ${movement.productVariant?.product.nameFr ?? ""} · ${[movement.productVariant?.color, movement.productVariant?.size].filter(Boolean).join(" / ")}`}</td><td>{movement.type}<small>{movement.reason}</small></td><td>{Number(movement.quantity).toLocaleString("fr-FR")}</td><td>{movement.order?.orderNumber ?? "—"}</td><td>{movement.actor.fullName}</td></tr>)}
              {!report.stockMovements.length && <tr><td colSpan={6}>Aucun mouvement de stock sur cette période.</td></tr>}
            </tbody></table></div>
          </section>

          <section className="admin-panel" data-report-group="USERS">
            <div className="admin-panel-heading"><div><h2>Activité récente</h2><p>Événements visibles selon vos droits d’accès.</p></div></div>
            <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Cible</th><th>Résultat</th></tr></thead><tbody>
              {report.auditEvents.map((event) => <tr key={event.id}><td>{new Date(event.occurredAt).toLocaleString("fr-FR")}</td><td>{event.actor.fullName}</td><td>{event.action}</td><td>{event.targetType}</td><td>{event.result}</td></tr>)}
              {!report.auditEvents.length && <tr><td colSpan={5}>Aucune activité journalisée sur cette période.</td></tr>}
            </tbody></table></div>
          </section>
        </>
      ) : <div className="admin-empty-state">Aucun rapport n’est disponible pour cette période.</div>}
    </div>
  );
}
