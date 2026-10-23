"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, CircleAlert, FileDown, LoaderCircle, Plus, RefreshCw, ShoppingCart, Wallet } from "lucide-react";
import { toast } from "sonner";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import { type AdminPageSize } from "@/lib/admin-pagination";
import type { Locale } from "@/lib/i18n";

type Register = { id: string; name: string; code: string };
type Session = {
  id: string;
  registerId: string;
  status: "OPEN" | "CLOSED";
  openingFloat: number;
  expectedClosing?: number | null;
  countedClosing?: number | null;
  variance?: number | null;
  varianceReviewedAt?: string | null;
  openedAt: string;
  closedAt?: string | null;
  expectedBalance?: number;
  closingSummary?: { payments: number; salesCount: number; expenses: number; refunds: number };
  register: Register;
  openedBy: { id: string; fullName: string };
};
type Operation = {
  id: string;
  type: string;
  method: string | null;
  amount: number;
  saleDescription: string | null;
  saleUnit: string | null;
  saleQuantity: string | number | null;
  saleUnitPrice: number | null;
  salesCategory: string | null;
  saleCategoryLabel: string | null;
  approvalStatus: string;
  expenseCategory: string | null;
  reason: string | null;
  occurredAt: string;
  actor: { id: string; fullName: string };
  register: { id: string; name: string };
  order?: {
    orderNumber: string;
    invoiceNumber: string;
    lines: { description: string; quantity: string | number; unitPrice: number; total: number }[];
  } | null;
};
type Transfer = {
  id: string;
  sourceRegisterId: string;
  destinationRegisterId: string;
  sourceSessionId: string;
  destinationSessionId: string | null;
  amount: number;
  reason: string;
  status: string;
  initiatedByUserId: string;
};
type ReasonAction =
  | { type: "approval"; operation: Operation; decision: "APPROVED" | "REJECTED" }
  | { type: "transfer"; transfer: Transfer; confirm: boolean }
  | { type: "variance"; session: Session };
type Dashboard = {
  registers: Register[];
  sessions: Session[];
  sessionHistory: Session[];
  sessionPagination: { page: number; pageSize: AdminPageSize; total: number; totalPages: number };
  operations: Operation[];
  pagination: { page: number; pageSize: AdminPageSize; total: number; totalPages: number };
  pendingApprovals: Operation[];
  transfers: Transfer[];
  transferTargets: { id: string; register: { id: string; name: string }; openedBy: { id: string; fullName: string } }[];
  staffUsers: { id: string; fullName: string }[];
  currentUser: { id: string | null; role: "ADMIN" | "MANAGER" | "CASHIER"; canApproveExpenses: boolean; canApproveRefunds: boolean; canExportReports: boolean };
  summaries: Record<"day" | "week" | "month", { revenue: number; expenses: number; payments: number; refunds: number }>;
  cashierTotals: { cashierId: string; cashierName: string; total: number }[];
  methodTotals: { method: string; total: number }[];
  salesByCategory: { category: string; total: number }[];
};

const methodLabels: Record<string, string> = { CASH: "Espèces", MOBILE_MONEY: "Mobile Money", BANK_TRANSFER: "Virement" };
const operationLabels: Record<string, string> = {
  PAYMENT: "Encaissement", EXPENSE: "Dépense", REFUND: "Remboursement",
  TRANSFER_IN: "Transfert reçu", TRANSFER_OUT: "Transfert envoyé", REVERSAL: "Contre-opération", ADJUSTMENT: "Ajustement",
};
const formatMoney = (value: number) => new Intl.NumberFormat("fr-FR").format(value) + " FCFA";

export default function CashRegisterManager({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [openSessionDialogOpen, setOpenSessionDialogOpen] = useState(false);
  const [closingSession, setClosingSession] = useState<Session | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [selectedRegister, setSelectedRegister] = useState("");
  const [openingFloat, setOpeningFloat] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [expenseSession, setExpenseSession] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseMethod, setExpenseMethod] = useState("CASH");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [saleSession, setSaleSession] = useState("");
  const [saleCategoryLabel, setSaleCategoryLabel] = useState("Impression en couleur");
  const [saleCustomItem, setSaleCustomItem] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [saleUnitPrice, setSaleUnitPrice] = useState("");
  const [saleMethod, setSaleMethod] = useState("CASH");
  const [sourceSession, setSourceSession] = useState("");
  const [destinationSession, setDestinationSession] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [saleRequestKey, setSaleRequestKey] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", cashierId: "", method: "", type: "", category: "", orderId: "", page: 1, pageSize: 25 as AdminPageSize });
  const draftStorageKey = `sitou-cash-draft:${data?.currentUser.id ?? ""}`;

  const load = useCallback(async (params?: URLSearchParams) => {
    try {
      const query = params?.toString();
      const response = await fetch(`/api/admin/caisse${query ? `?${query}` : ""}`, { cache: "no-store" });
      const result: Dashboard & { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger la caisse.");
      setData(result);
      setSaleSession((current) => result.sessions.some((session) => session.id === current)
        ? current
        : result.sessions[0]?.id ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger la caisse.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch financial data from the role-scoped server endpoint on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Restore this user's unsaved cash forms from the current tab after sessions load.
  useEffect(() => {
    const userId = data?.currentUser.id;
    if (!userId) return;
    try {
      const saved = sessionStorage.getItem(draftStorageKey);
      if (saved) {
        const draft: unknown = JSON.parse(saved);
        if (typeof draft === "object" && draft !== null) {
          const record = draft as Record<string, unknown>;
          const textFields = [
            ["selectedRegister", setSelectedRegister],
            ["openingFloat", setOpeningFloat],
            ["closeAmount", setCloseAmount],
            ["closeNote", setCloseNote],
            ["expenseSession", setExpenseSession],
            ["expenseAmount", setExpenseAmount],
            ["expenseMethod", setExpenseMethod],
            ["expenseCategory", setExpenseCategory],
            ["expenseReason", setExpenseReason],
            ["saleSession", setSaleSession],
            ["saleCategoryLabel", setSaleCategoryLabel],
            ["saleCustomItem", setSaleCustomItem],
            ["saleQuantity", setSaleQuantity],
            ["saleUnitPrice", setSaleUnitPrice],
            ["saleMethod", setSaleMethod],
            ["sourceSession", setSourceSession],
            ["destinationSession", setDestinationSession],
            ["transferAmount", setTransferAmount],
            ["transferReason", setTransferReason],
          ] as const;
          for (const [key, setter] of textFields) {
            if (typeof record[key] === "string") setter(record[key]);
          }
          // eslint-disable-next-line react-hooks/set-state-in-effect
          if (record.openSessionDialogOpen === true) setOpenSessionDialogOpen(true);
          if (record.expenseDialogOpen === true) setExpenseDialogOpen(true);
          if (record.saleDialogOpen === true) setSaleDialogOpen(true);
          if (typeof record.saleRequestKey === "string") setSaleRequestKey(record.saleRequestKey);
          if (record.transferDialogOpen === true) setTransferDialogOpen(true);
          if (typeof record.closingSessionId === "string") {
            const session = data.sessions.find((entry) => entry.id === record.closingSessionId);
            if (session) setClosingSession(session);
          }
        }
      }
    } catch (error) {
      console.error("Cash draft restore:", error);
      toast.error("Les saisies de caisse précédentes n’ont pas pu être restaurées.");
    } finally {
      setDraftReady(true);
    }
  }, [data?.currentUser.id, data?.sessions, draftStorageKey]);

  useEffect(() => {
    if (!draftReady || !data?.currentUser.id) return;
    const hasDraft = Boolean(openSessionDialogOpen || expenseDialogOpen || saleDialogOpen || transferDialogOpen || closingSession
      || openingFloat || closeAmount || closeNote || expenseAmount || expenseCategory || expenseReason
      || saleRequestKey || saleCustomItem || saleUnitPrice || transferAmount || transferReason);
    try {
      if (!hasDraft) {
        sessionStorage.removeItem(draftStorageKey);
        return;
      }
      sessionStorage.setItem(draftStorageKey, JSON.stringify({
        selectedRegister,
        openingFloat,
        closeAmount,
        closeNote,
        expenseSession,
        expenseAmount,
        expenseMethod,
        expenseCategory,
        expenseReason,
        saleSession,
        saleCategoryLabel,
        saleCustomItem,
        saleQuantity,
        saleUnitPrice,
        saleMethod,
        saleRequestKey,
        sourceSession,
        destinationSession,
        transferAmount,
        transferReason,
        openSessionDialogOpen,
        expenseDialogOpen,
        saleDialogOpen,
        transferDialogOpen,
        closingSessionId: closingSession?.id ?? null,
      }));
    } catch (error) {
      console.error("Cash draft save:", error);
      toast.error("Les saisies de caisse ne peuvent pas être conservées dans cette session.");
    }
  }, [
    draftReady, data?.currentUser.id, draftStorageKey, selectedRegister, openingFloat, closeAmount, closeNote,
    expenseSession, expenseAmount, expenseMethod, expenseCategory, expenseReason, saleSession,
    saleCategoryLabel, saleCustomItem, saleQuantity, saleUnitPrice, saleMethod, saleRequestKey,
    sourceSession, destinationSession, transferAmount, transferReason, openSessionDialogOpen, expenseDialogOpen, saleDialogOpen,
    transferDialogOpen, closingSession,
  ]);

  async function requestJson(url: string, method: string, body?: object) {
    const response = await fetch(url, {
      method,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const result: { error?: string } = await response.json();
    if (!response.ok) throw new Error(result.error || "L’opération a échoué.");
  }

  async function submit(event: FormEvent<HTMLFormElement>, action: () => Promise<void>, success: string) {
    event.preventDefault();
    setSaving(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L’opération a échoué.");
    } finally {
      setSaving(false);
    }
  }

  async function openSession(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      await requestJson("/api/admin/caisse/sessions", "POST", {
        registerId: selectedRegister,
        openingFloat: Number(openingFloat),
      });
      setOpeningFloat("");
      setOpenSessionDialogOpen(false);
    }, "Session de caisse ouverte.");
  }

  async function closeSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmClose(true);
  }

  async function confirmCloseSession() {
    if (!closingSession) return;
    setSaving(true);
    try {
      await requestJson(`/api/admin/caisse/sessions/${closingSession.id}/close`, "POST", {
        countedClosing: Number(closeAmount),
        note: closeNote,
      });
      setCloseAmount("");
      setCloseNote("");
      setConfirmClose(false);
      setClosingSession(null);
      toast.success("Session clôturée. L’écart a été enregistré.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de clôturer la session.");
    } finally {
      setSaving(false);
    }
  }

  async function createExpense(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      await requestJson("/api/admin/caisse/operations", "POST", {
        sessionId: expenseSession,
        amount: Number(expenseAmount),
        method: expenseMethod,
        expenseCategory,
        reason: expenseReason,
      });
      setExpenseAmount("");
      setExpenseCategory("");
      setExpenseReason("");
      setExpenseDialogOpen(false);
    }, "Dépense enregistrée ou transmise pour approbation.");
  }

  async function createCounterSale(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const requestKey = saleRequestKey ?? crypto.randomUUID();
      setSaleRequestKey(requestKey);
      await requestJson("/api/admin/caisse/ventes", "POST", {
        requestKey,
        sessionId: saleSession,
        categoryLabel: saleCategoryLabel,
        customItem: saleCustomItem,
        quantity: Number(saleQuantity),
        unitPrice: Number(saleUnitPrice),
        method: saleMethod,
      });
      setSaleRequestKey(null);
      setSaleCategoryLabel("Impression en couleur");
      setSaleCustomItem("");
      setSaleQuantity("1");
      setSaleUnitPrice("");
      setSaleMethod("CASH");
      setSaleDialogOpen(false);
    }, "Vente comptoir enregistrée.");
  }

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      await requestJson("/api/admin/caisse/transferts", "POST", {
        sourceSessionId: sourceSession,
        destinationSessionId: destinationSession,
        amount: Number(transferAmount),
        reason: transferReason,
      });
      setTransferAmount("");
      setTransferReason("");
      setTransferDialogOpen(false);
    }, "Transfert envoyé au destinataire pour confirmation.");
  }

  async function approveOperation(operation: Operation, decision: "APPROVED" | "REJECTED") {
    setActionReason("");
    setReasonAction({ type: "approval", operation, decision });
  }

  async function confirmTransfer(transfer: Transfer, confirm: boolean) {
    setActionReason("");
    setReasonAction({ type: "transfer", transfer, confirm });
  }

  async function reviewVariance(session: Session) {
    setActionReason("");
    setReasonAction({ type: "variance", session });
  }

  async function submitReasonAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reasonAction) return;
    setSaving(true);
    try {
      if (reasonAction.type === "approval") {
        await requestJson(`/api/admin/caisse/operations/${reasonAction.operation.id}/approval`, "PATCH", {
          decision: reasonAction.decision,
          reason: actionReason.trim(),
        });
        toast.success(reasonAction.decision === "APPROVED" ? "Opération approuvée." : "Opération refusée.");
      } else if (reasonAction.type === "transfer") {
        await requestJson(`/api/admin/caisse/transferts/${reasonAction.transfer.id}`, "PATCH", {
          confirm: reasonAction.confirm,
          reason: actionReason.trim(),
        });
        toast.success(reasonAction.confirm ? "Transfert confirmé et inscrit dans les deux historiques." : "Transfert refusé.");
      } else {
        await requestJson(`/api/admin/caisse/sessions/${reasonAction.session.id}/review`, "POST", {
          reason: actionReason.trim(),
        });
        toast.success("Écart examiné. Le caissier pourra ouvrir une nouvelle session.");
      }
      setReasonAction(null);
      setActionReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de traiter cette opération.");
    } finally {
      setSaving(false);
    }
  }

  async function exportReport() {
    try {
      const response = await fetch("/api/admin/caisse/export", { cache: "no-store" });
      if (!response.ok) {
        const result: { error?: string } = await response.json();
        throw new Error(result.error || "Impossible d’exporter le rapport.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "rapport-caisse.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’exporter le rapport.");
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    for (const [key, value] of Object.entries(nextFilters)) if (value) params.set(key, String(value));
    if (data) {
      params.set("sessionPage", String(data.sessionPagination.page));
      params.set("sessionPageSize", String(data.sessionPagination.pageSize));
    }
    setLoading(true);
    void load(params);
  }

  function changeOperationPage(page: number, pageSize = filters.pageSize) {
    const nextFilters = { ...filters, page, pageSize };
    setFilters(nextFilters);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) if (value) params.set(key, String(value));
    if (data) {
      params.set("sessionPage", String(data.sessionPagination.page));
      params.set("sessionPageSize", String(data.sessionPagination.pageSize));
    }
    setLoading(true);
    void load(params);
  }

  function changeSessionPage(page: number, pageSize = data?.sessionPagination.pageSize ?? 25) {
    if (!data) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page: data.pagination.page, pageSize: data.pagination.pageSize })) {
      if (value) params.set(key, String(value));
    }
    params.set("sessionPage", String(page));
    params.set("sessionPageSize", String(pageSize));
    setLoading(true);
    void load(params);
  }

  if (loading && !data) {
    return <div className="admin-content"><div className="admin-empty-state"><LoaderCircle className="animate-spin" size={24} />Chargement du tableau de caisse…</div></div>;
  }
  if (!data) return <div className="admin-content"><div className="admin-empty-state">Impossible de charger la caisse.</div></div>;

  const openSessions = data.sessions;
  const canApprove = data.currentUser.role === "ADMIN" || data.currentUser.canApproveExpenses || data.currentUser.canApproveRefunds;
  const pendingOperations = data.pendingApprovals;
  const ownPendingTransfers = data.transfers.filter((transfer) => transfer.status === "REQUESTED");

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div><span className="admin-eyebrow">FINANCE · FCFA</span><h1>{en ? "Cash management" : "Gestion de caisse"}</h1><p>{en ? "Live cash position, individual sessions and traceable operations." : "Suivez les recettes, dépenses, sessions individuelles et opérations tracées."}</p></div>
        <div className="admin-heading-actions">
          <Link className="admin-primary-button" href={`/${locale}/admin/commandes`}><ShoppingCart size={16} />Nouvelle commande / facture</Link>
          {data.currentUser.role === "ADMIN" || data.currentUser.canExportReports ? <button type="button" className="admin-quiet-button" onClick={() => void exportReport()}><ArrowDownLeft size={16} />Exporter Excel (CSV)</button> : null}
          <button type="button" className="admin-quiet-button" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw size={16} /> Actualiser</button>
        </div>
      </header>

      <section className="admin-finance-kpis">
        {(["day", "week", "month"] as const).map((period) => {
          const summary = data.summaries[period];
          const label = period === "day" ? "Aujourd’hui" : period === "week" ? "Cette semaine" : "Ce mois";
          return <article className="admin-finance-kpi" key={period}><span>{label}</span><strong>{formatMoney(summary.revenue)}</strong><small>Recettes nettes · Dépenses : {formatMoney(summary.expenses)}</small></article>;
        })}
      </section>

      {data.currentUser.role === "ADMIN" && (
        <section className="admin-panel admin-service-form">
          <div className="admin-panel-heading"><div><span className="admin-eyebrow">CONFIGURATION</span><h2>Caisses</h2><p>Chaque caisse ne peut avoir qu’une session active à la fois.</p></div><Wallet size={21} /></div>
          <button type="button" className="admin-primary-button" onClick={() => setRegisterDialogOpen(true)}><Plus size={17} />Créer une caisse</button>
        </section>
      )}

      <section className="admin-finance-columns">
        <article className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Sessions ouvertes</h2><p>Chaque ouverture, clôture et écart est conservé dans l’historique.</p></div><div className="admin-form-actions"><Banknote size={20} />{openSessions.length === 0 && data.registers.length > 0 && <button type="button" className="admin-primary-button" onClick={() => setOpenSessionDialogOpen(true)}><Plus size={16} />Ouvrir ma caisse</button>}</div></div>
          {openSessions.length > 0 ? openSessions.map((session) => (
            <div className="admin-cash-session" key={session.id}>
              <div className="admin-cash-session-head"><div><strong>{session.register.name}</strong><span>{session.openedBy.fullName} · ouverte {new Date(session.openedAt).toLocaleString("fr-FR")}</span></div><span className="admin-status-pill is-active">Ouverte</span></div>
              <p>Fond initial <strong>{formatMoney(session.openingFloat)}</strong> · Solde théorique <strong>{formatMoney(session.expectedBalance ?? session.openingFloat)}</strong></p>
              {(data.currentUser.role === "ADMIN" || session.openedBy.id === data.currentUser.id) && (
                <button type="button" className="admin-quiet-button" onClick={() => { setCloseAmount(""); setCloseNote(""); setClosingSession(session); }}>Clôturer la session</button>
              )}
            </div>
          )) : <p className="admin-muted-copy">Aucune session de caisse n’est ouverte.</p>}
          {data.registers.length === 0 && <p className="admin-muted-copy">Un responsable doit d’abord créer une caisse pour permettre les ouvertures.</p>}
        </article>

        <article className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Opérations de caisse</h2><p>Enregistrez directement les ventes et dépenses de la journée.</p></div><ArrowDownLeft size={20} /></div>
          <div className="admin-form-actions">
            <button type="button" className="admin-primary-button" onClick={() => setSaleDialogOpen(true)} disabled={saving || openSessions.length === 0}><ShoppingCart size={16} />Enregistrer une vente</button>
            <button type="button" className="admin-quiet-button" onClick={() => setExpenseDialogOpen(true)} disabled={saving || openSessions.length === 0}><ArrowDownLeft size={16} />Nouvelle dépense</button>
          </div>
        </article>
      </section>

      {(openSessions.length > 1 || (data.currentUser.role !== "ADMIN" && data.transferTargets.length > 1)) && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Transfert entre caisses</h2><p>Le caissier destinataire doit confirmer le montant reçu. Les deux historiques sont alimentés simultanément.</p></div><ArrowUpRight size={20} /></div>
          <button type="button" className="admin-primary-button" onClick={() => setTransferDialogOpen(true)}><ArrowUpRight size={16} />Demander un transfert</button>
          {ownPendingTransfers.length > 0 && <div className="admin-pending-list">{ownPendingTransfers.map((transfer) => {
            const isRecipient = openSessions.some((session) => session.id === transfer.destinationSessionId && session.openedBy.id === data.currentUser.id);
            return <div className="admin-pending-row" key={transfer.id}><span>{formatMoney(transfer.amount)} · {transfer.reason}</span>{isRecipient && <div><button type="button" className="admin-quiet-button" disabled={saving} onClick={() => void confirmTransfer(transfer, true)}><Check size={15} />Confirmer réception</button><button type="button" className="admin-quiet-button" disabled={saving} onClick={() => void confirmTransfer(transfer, false)}>Refuser</button></div>}</div>;
          })}</div>}
        </section>
      )}

      {canApprove && pendingOperations.length > 0 && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>À approuver</h2><p>Les demandes sont tracées avec leur motif et leur approbateur.</p></div><CircleAlert size={20} /></div>
          {pendingOperations.map((operation) => (
            <div className="admin-pending-row" key={operation.id}>
              <span>{operation.actor.fullName} · {operationLabels[operation.type]} · {formatMoney(operation.amount)} · {operation.reason}</span>
              {operation.actor.id !== data.currentUser.id && <div><button type="button" className="admin-quiet-button" disabled={saving} onClick={() => void approveOperation(operation, "APPROVED")}><Check size={15} />Approuver</button><button type="button" className="admin-quiet-button" disabled={saving} onClick={() => void approveOperation(operation, "REJECTED")}>Refuser</button></div>}
            </div>
          ))}
        </section>
      )}

      {data.currentUser.role === "ADMIN" && data.cashierTotals.length > 0 && (
        <section className="admin-finance-columns">
          <article className="admin-panel"><div className="admin-panel-heading"><div><h2>Encaissements par caissier</h2><p>Montants bruts reçus sur la période affichée.</p></div></div>{data.cashierTotals.map((item) => <div className="admin-report-row" key={item.cashierId}><span>{item.cashierName}</span><strong>{formatMoney(item.total)}</strong></div>)}</article>
          <article className="admin-panel"><div className="admin-panel-heading"><div><h2>Modes de paiement</h2><p>Répartition des encaissements.</p></div></div>{data.methodTotals.map((item) => <div className="admin-report-row" key={item.method}><span>{methodLabels[item.method] ?? item.method}</span><strong>{formatMoney(item.total)}</strong></div>)}</article>
        </section>
      )}
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Chiffre d’affaires par catégorie</h2><p>Montants nets des remboursements et annulations approuvés.</p></div></div>
        <div className="admin-category-chart">
          {[
            ["GRAPHIC_DESIGN", "Graphisme"],
            ["PRINTING", "Impression"],
            ["ADVERTISING", "Supports publicitaires"],
            ["OTHER", "Autres prestations"],
          ].map(([category, label]) => {
            const total = data.salesByCategory.find((item) => item.category === category)?.total ?? 0;
            const maxTotal = Math.max(1, ...data.salesByCategory.map((item) => Math.max(0, item.total)));
            return <div className="admin-category-bar" key={category}><div><span>{label}</span><strong>{formatMoney(total)}</strong></div><span className="admin-category-track"><span style={{ width: `${Math.max(0, total) / maxTotal * 100}%` }} /></span></div>;
          })}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Historique des opérations</h2><p>Les opérations validées sont conservées et ne peuvent pas être supprimées.</p></div><Wallet size={20} /></div>
        <form className="admin-cash-filters" onSubmit={applyFilters}>
          <label>Du<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label>Au<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          {data.currentUser.role === "ADMIN" && <label>Caissier<select value={filters.cashierId} onChange={(event) => setFilters({ ...filters, cashierId: event.target.value })}><option value="">Tous</option>{data.staffUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label>}
          <label>Catégorie de vente<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">Toutes</option><option value="GRAPHIC_DESIGN">Graphisme</option><option value="PRINTING">Impression</option><option value="ADVERTISING">Supports publicitaires</option><option value="OTHER">Autres</option></select></label>
          <label>Type<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">Tous</option>{Object.entries(operationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Paiement<select value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value })}><option value="">Tous</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="submit" className="admin-quiet-button"><RefreshCw size={15} />Filtrer</button>
        </form>
        <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Date</th><th>Caisse · caissier</th><th>Opération</th><th>Mode</th><th>Commande</th><th>Statut</th><th className="is-number">Montant</th></tr></thead><tbody>
          {data.operations.map((operation) => <tr key={operation.id}><td>{new Date(operation.occurredAt).toLocaleString("fr-FR")}</td><td>{operation.register.name}<small>{operation.actor.fullName}</small></td><td>{operationLabels[operation.type] ?? operation.type}<small>{operation.expenseCategory || operation.reason}</small></td><td>{operation.method ? methodLabels[operation.method] : "—"}</td><td>{operation.order?.orderNumber ?? (operation.saleDescription ? `Vente comptoir · ${operation.id.slice(-8).toUpperCase()}` : "—")}{operation.saleDescription && <small>{operation.saleCategoryLabel ?? operation.salesCategory ?? "Autre"} · {operation.saleDescription} · {Number(operation.saleQuantity ?? 0).toLocaleString("fr-FR")} × {formatMoney(operation.saleUnitPrice ?? 0)}</small>}{operation.order?.lines.map((line, index) => <small key={`${operation.id}-line-${index}`}>{line.description} · {Number(line.quantity).toLocaleString("fr-FR")} × {formatMoney(line.unitPrice)}</small>)}</td><td><span className={`admin-status-pill${operation.approvalStatus === "APPROVED" || operation.approvalStatus === "NOT_REQUIRED" ? " is-active" : ""}`}>{operation.approvalStatus === "REQUESTED" ? "À approuver" : operation.approvalStatus === "REJECTED" ? "Refusée" : "Validée"}</span></td><td className="is-number">{formatMoney(operation.amount)}{operation.saleDescription && <a className="admin-quiet-button" href={`/api/admin/caisse/ventes/${encodeURIComponent(operation.id)}/pdf`} target="_blank" rel="noreferrer"><FileDown size={15} />PDF</a>}</td></tr>)}
          {data.operations.length === 0 && <tr><td colSpan={7}>Aucune opération trouvée.</td></tr>}
        </tbody></table></div>
        <AdminPagination
          page={data.pagination.page}
          pageSize={data.pagination.pageSize}
          total={data.pagination.total}
          totalPages={data.pagination.totalPages}
          onPageChange={(page) => changeOperationPage(page)}
          onPageSizeChange={(pageSize) => changeOperationPage(1, pageSize)}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Historique des sessions</h2><p>{data.sessionPagination.total} session(s) · Consultation selon les droits d’accès. Un nouvel écart bloque une ouverture jusqu’à son examen.</p></div></div>
        {data.sessionHistory.length ? data.sessionHistory.map((session) => <div className="admin-report-row" key={session.id}><span>{session.register.name} · {new Date(session.openedAt).toLocaleString("fr-FR")}<small>{session.openedBy.fullName} · écart {session.variance == null ? "—" : formatMoney(session.variance)}{session.variance && !session.varianceReviewedAt ? " · examen requis" : ""}</small></span><div><strong>{session.status === "OPEN" ? "Ouverte" : `Compté ${formatMoney(session.countedClosing ?? 0)}`}</strong>{data.currentUser.role === "ADMIN" && session.variance && !session.varianceReviewedAt ? <button type="button" className="admin-quiet-button" onClick={() => void reviewVariance(session)} disabled={saving}>Examiner l’écart</button> : null}</div></div>) : <div className="admin-empty-state">Aucune session enregistrée.</div>}
        <AdminPagination
          page={data.sessionPagination.page}
          pageSize={data.sessionPagination.pageSize}
          total={data.sessionPagination.total}
          totalPages={data.sessionPagination.totalPages}
          onPageChange={(page) => changeSessionPage(page)}
          onPageSizeChange={(pageSize) => changeSessionPage(1, pageSize)}
        />
      </section>

      <AdminDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen} title="Créer une caisse" description="Chaque caisse ne peut avoir qu’une session active à la fois." closeLabel="Fermer le formulaire">
        <form className="admin-form-grid" onSubmit={(event) => void submit(event, async () => {
          await requestJson("/api/admin/caisse", "POST", { name: registerName, code: registerCode });
          setRegisterName(""); setRegisterCode(""); setRegisterDialogOpen(false);
        }, "Caisse créée.")}>
          <label>Nom de la caisse<input required minLength={2} maxLength={80} value={registerName} onChange={(event) => setRegisterName(event.target.value)} placeholder="Ex. Caisse principale" /></label>
          <label>Code<input required minLength={2} maxLength={24} value={registerCode} onChange={(event) => setRegisterCode(event.target.value.toUpperCase())} placeholder="Ex. CAISSE-01" /></label>
          <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setRegisterDialogOpen(false)}>Annuler</button><button className="admin-primary-button" disabled={saving}><Plus size={17} />Créer la caisse</button></div>
        </form>
      </AdminDialog>

      <AdminDialog open={openSessionDialogOpen} onOpenChange={setOpenSessionDialogOpen} title="Ouvrir une session de caisse" description="Saisis le fond de caisse présent au début de ton service." closeLabel="Fermer le formulaire">
        <form className="admin-form-grid" onSubmit={(event) => void openSession(event)}>
          <label className="admin-form-full">Choisir une caisse<select required value={selectedRegister} onChange={(event) => setSelectedRegister(event.target.value)}><option value="">Sélectionner…</option>{data.registers.map((register) => <option key={register.id} value={register.id}>{register.name} · {register.code}</option>)}</select></label>
          <label className="admin-form-full">Fond initial (FCFA)<input required type="number" min={0} step={1} value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} /></label>
          <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setOpenSessionDialogOpen(false)}>Annuler</button><button className="admin-primary-button" disabled={saving}><Plus size={16} />Ouvrir ma caisse</button></div>
        </form>
      </AdminDialog>

      <AdminDialog open={closingSession !== null} onOpenChange={(open) => { if (!open && !confirmClose) setClosingSession(null); }} title="Clôturer la session" description={closingSession ? `${closingSession.register.name} · solde théorique espèces ${formatMoney(closingSession.expectedBalance ?? closingSession.openingFloat)}.` : undefined} closeLabel="Fermer le formulaire">
        {closingSession && <form className="admin-form-grid" onSubmit={(event) => void closeSession(event)}>
          <div className="admin-form-full admin-cash-close-summary">
            <div><span>Ventes encaissées ({closingSession.closingSummary?.salesCount ?? 0} commande(s))</span><strong>{formatMoney(closingSession.closingSummary?.payments ?? 0)}</strong></div>
            <div><span>Dépenses</span><strong>{formatMoney(closingSession.closingSummary?.expenses ?? 0)}</strong></div>
            <div><span>Remboursements</span><strong>{formatMoney(closingSession.closingSummary?.refunds ?? 0)}</strong></div>
            <div><span>Solde théorique espèces</span><strong>{formatMoney(closingSession.expectedBalance ?? closingSession.openingFloat)}</strong></div>
          </div>
          <label className="admin-form-full">Montant compté<input required type="number" min={0} step={1} value={closeAmount} onChange={(event) => setCloseAmount(event.target.value)} placeholder="Montant physique en FCFA" /></label>
          <label className="admin-form-full">Motif si écart<input maxLength={2000} value={closeNote} onChange={(event) => setCloseNote(event.target.value)} placeholder="Obligatoire si le montant diffère" /></label>
          <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setClosingSession(null)}>Annuler</button><button type="submit" className="admin-primary-button" disabled={saving}>Vérifier la clôture</button></div>
        </form>}
      </AdminDialog>
      <AdminConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Confirmer la clôture de caisse"
        description={closingSession
          ? `Tu vas clôturer ${closingSession.register.name}. Théorique : ${formatMoney(closingSession.expectedBalance ?? closingSession.openingFloat)} · compté : ${formatMoney(Number(closeAmount))} · écart : ${formatMoney(Number(closeAmount) - (closingSession.expectedBalance ?? closingSession.openingFloat))}. Cette action sera enregistrée dans l’historique et ne pourra pas être répétée.`
          : "Confirme la clôture de la session."}
        cancelLabel="Retour"
        confirmLabel="Clôturer définitivement"
        busy={saving}
        onConfirm={() => void confirmCloseSession()}
      />

      <AdminDialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen} title="Enregistrer une dépense" description="Les dépenses des caissiers attendent une approbation." closeLabel="Fermer le formulaire">
        <form className="admin-form-grid" onSubmit={(event) => void createExpense(event)}>
          <label className="admin-form-full">Session ouverte<select required value={expenseSession} onChange={(event) => setExpenseSession(event.target.value)}><option value="">Sélectionner…</option>{openSessions.map((session) => <option key={session.id} value={session.id}>{session.register.name} · {session.openedBy.fullName}</option>)}</select></label>
          <label>Montant (FCFA)<input required type="number" min={1} step={1} value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} /></label>
          <label>Mode de paiement<select value={expenseMethod} onChange={(event) => setExpenseMethod(event.target.value)}><option value="CASH">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK_TRANSFER">Virement</option></select></label>
          <label>Catégorie<input required minLength={2} maxLength={100} value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} placeholder="Ex. Fournitures" /></label>
          <label className="admin-form-full">Motif<textarea required minLength={5} maxLength={2000} rows={3} value={expenseReason} onChange={(event) => setExpenseReason(event.target.value)} /></label>
          <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setExpenseDialogOpen(false)}>Annuler</button><button className="admin-primary-button" disabled={saving || openSessions.length === 0}><ArrowDownLeft size={16} />Enregistrer la dépense</button></div>
        </form>
      </AdminDialog>

      <AdminDialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen} title="Enregistrer une vente comptoir" description="Saisissez les ventes notées dans le cahier, y compris les prestations et produits non configurés." closeLabel="Fermer le formulaire">
        <form className="admin-form-grid" onSubmit={(event) => void createCounterSale(event)}>
          <label className="admin-form-full">Session ouverte<select required value={saleSession} onChange={(event) => setSaleSession(event.target.value)}><option value="">Sélectionner…</option>{openSessions.map((session) => <option key={session.id} value={session.id}>{session.register.name} · {session.openedBy.fullName}</option>)}</select></label>
          <label className="admin-form-full">Catégorie<select required value={saleCategoryLabel} onChange={(event) => setSaleCategoryLabel(event.target.value)}><option>Impression en couleur</option><option>Impression Blanc/noir</option><option>Impression/papier special en couleur</option><option>Impression/PVC</option><option>photocopie en couleur</option><option>photocopie Blanc/noir</option><option>reliures</option><option>Chemises cartonnées</option><option>Enveloppe</option><option>Article non répertorié</option></select></label>
          <label className="admin-form-full">{saleCategoryLabel === "Article non répertorié" ? "Article non répertorié" : "Détail complémentaire (facultatif)"}<input required={saleCategoryLabel === "Article non répertorié"} minLength={saleCategoryLabel === "Article non répertorié" ? 2 : undefined} maxLength={200} value={saleCustomItem} onChange={(event) => setSaleCustomItem(event.target.value)} placeholder="Saisir le nom de l’article ou du service" /></label>
          <label>Quantité<input required type="number" min={0.001} step="0.001" value={saleQuantity} onChange={(event) => setSaleQuantity(event.target.value)} /></label>
          <label>Prix unitaire (FCFA)<input required type="number" min={1} step={1} value={saleUnitPrice} onChange={(event) => setSaleUnitPrice(event.target.value)} /></label>
          <label>Mode de paiement<select required value={saleMethod} onChange={(event) => setSaleMethod(event.target.value)}><option value="CASH">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK_TRANSFER">Virement</option></select></label>
          <p className="admin-form-full">Total calculé : <strong>{formatMoney(Math.round(Number(saleQuantity || 0) * Number(saleUnitPrice || 0)))}</strong></p>
          <p className="admin-form-full">La date, l’heure et le caissier connecté seront enregistrés automatiquement. Chaque vente est visible dans l’historique et peut être imprimée ou enregistrée en PDF.</p>
          <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setSaleDialogOpen(false)}>Annuler</button><button className="admin-primary-button" disabled={saving || openSessions.length === 0}><ShoppingCart size={16} />Enregistrer la vente</button></div>
        </form>
      </AdminDialog>

      <AdminDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen} title="Transférer entre caisses" description="Le caissier destinataire devra confirmer le montant reçu." closeLabel="Fermer le formulaire">
        <form className="admin-form-grid" onSubmit={(event) => void createTransfer(event)}>
          <label>Caisse source<select required value={sourceSession} onChange={(event) => setSourceSession(event.target.value)}><option value="">Choisir la source…</option>{openSessions.map((session) => <option key={session.id} value={session.id}>{session.register.name} · {session.openedBy.fullName}</option>)}</select></label>
          <label>Caisse destinataire<select required value={destinationSession} onChange={(event) => setDestinationSession(event.target.value)}><option value="">Choisir le destinataire…</option>{(data.currentUser.role !== "ADMIN" ? data.transferTargets : openSessions).filter((session) => session.id !== sourceSession).map((session) => <option key={session.id} value={session.id}>{session.register.name} · {session.openedBy.fullName}</option>)}</select></label>
          <label>Montant (FCFA)<input required type="number" min={1} step={1} value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} /></label>
          <label>Motif<input required minLength={5} maxLength={1000} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} /></label>
          <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setTransferDialogOpen(false)}>Annuler</button><button className="admin-primary-button" disabled={saving}><ArrowUpRight size={16} />Demander le transfert</button></div>
        </form>
      </AdminDialog>

      <AdminDialog
        open={reasonAction !== null}
        onOpenChange={(open) => { if (!open) setReasonAction(null); }}
        title={reasonAction?.type === "approval"
          ? reasonAction.decision === "APPROVED" ? "Approuver l’opération" : "Refuser l’opération"
          : reasonAction?.type === "transfer"
            ? reasonAction.confirm ? "Confirmer le transfert reçu" : "Refuser le transfert"
            : "Examiner l’écart de caisse"}
        description={reasonAction?.type === "variance"
          ? `Écart constaté : ${formatMoney(reasonAction.session.variance ?? 0)}. Cette justification sera conservée dans l’audit.`
          : "Le motif sera enregistré dans le journal de caisse."}
        closeLabel="Fermer le formulaire"
      >
        <form className="admin-form-grid" onSubmit={(event) => void submitReasonAction(event)}>
          <label className="admin-form-full">Motif<textarea required minLength={3} maxLength={2000} rows={4} value={actionReason} onChange={(event) => setActionReason(event.target.value)} /></label>
          <div className="admin-form-full admin-form-actions">
            <button type="button" className="admin-quiet-button" onClick={() => setReasonAction(null)}>Annuler</button>
            <button className="admin-primary-button" disabled={saving || actionReason.trim().length < 3}>
              {reasonAction?.type === "approval"
                ? reasonAction.decision === "APPROVED" ? "Approuver" : "Refuser"
                : reasonAction?.type === "transfer"
                  ? reasonAction.confirm ? "Confirmer la réception" : "Refuser le transfert"
                  : "Examiner l’écart"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
