"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Boxes, FileText, LoaderCircle, Plus, ReceiptText, X } from "lucide-react";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import { type AdminPageSize } from "@/lib/admin-pagination";

type Line = {
  kind: "CUSTOM" | "SERVICE" | "VARIANT";
  description: string;
  quantity: string;
  unitPrice: string;
  category: string;
  serviceId: string;
  productVariantId: string;
};
type SaleService = { id: string; titleFr: string; titleEn: string; unitPrice: number; billingUnit: string | null; salesCategory: string };
type SaleVariant = {
  id: string; sku: string; color: string; size: string; unitPrice: number;
  quantityOnHand: string; quantityReserved: string;
  product: { nameFr: string; nameEn: string };
};
type Payment = { id: string; amount: number; method: string; reference: string | null; createdAt: string };
type Order = {
  id: string; orderNumber: string; invoiceNumber: string; customerName: string; category: string;
  status: string; totalAmount: number; paidAmount: number; remainingAmount: number;
  createdAt: string; createdBy: { fullName: string }; payments: Payment[];
};
type Quote = { id: string; reference: string; fullName: string; status: string };
type Pagination = { page: number; pageSize: AdminPageSize; total: number; totalPages: number };
const categories = [
  ["GRAPHIC_DESIGN", "Graphisme"],
  ["PRINTING", "Impression"],
  ["ADVERTISING", "Supports publicitaires"],
  ["OTHER", "Autres prestations"],
];
const methods = [["CASH", "Espèces"], ["MOBILE_MONEY", "Mobile Money"], ["BANK_TRANSFER", "Virement bancaire"]];
const money = (amount: number) => new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
function isOrderLine(value: unknown): value is Line {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return ["CUSTOM", "SERVICE", "VARIANT"].includes(String(line.kind))
    && ["description", "quantity", "unitPrice", "category", "serviceId", "productVariantId"].every((key) => typeof line[key] === "string");
}

export default function OrderManager({ locale, role, staffId }: { locale: Locale; role: "ADMIN" | "MANAGER" | "CASHIER"; staffId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sessions, setSessions] = useState<{ id: string; register: { name: string } }[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);
  const [refundAction, setRefundAction] = useState<"REFUND" | "REVERSAL">("REFUND");
  const [refundPaymentId, setRefundPaymentId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [quoteRequestId, setQuoteRequestId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ kind: "CUSTOM", description: "", quantity: "1", unitPrice: "", category: "OTHER", serviceId: "", productVariantId: "" }]);
  const [saleServices, setSaleServices] = useState<SaleService[]>([]);
  const [saleVariants, setSaleVariants] = useState<SaleVariant[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [amounts, setAmounts] = useState({ CASH: "", MOBILE_MONEY: "", BANK_TRANSFER: "" });
  const [references, setReferences] = useState({ CASH: "", MOBILE_MONEY: "", BANK_TRANSFER: "" });
  const [savedPayingOrderId, setSavedPayingOrderId] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const orderRequestKey = useRef<string | null>(null);
  const paymentRequestKey = useRef<string | null>(null);
  const draftStorageKey = `sitou-order-draft:${staffId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (appliedFilters.search) params.set("q", appliedFilters.search);
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      const [ordersResponse, cashResponse, catalogueResponse] = await Promise.all([
        fetch(`/api/admin/commandes?${params}`, { cache: "no-store" }),
        fetch("/api/admin/caisse", { cache: "no-store" }),
        fetch("/api/admin/caisse/catalogue", { cache: "no-store" }),
      ]);
      const ordersData: { orders?: Order[]; pagination?: Pagination; error?: string } = await ordersResponse.json();
      const cashData: { sessions?: { id: string; register: { name: string } }[]; error?: string } = await cashResponse.json();
      const catalogueData: { services?: SaleService[]; variants?: SaleVariant[]; error?: string } = await catalogueResponse.json();
      if (!ordersResponse.ok || !Array.isArray(ordersData.orders) || !ordersData.pagination) throw new Error(ordersData.error || "Impossible de charger les commandes.");
      if (!cashResponse.ok || !Array.isArray(cashData.sessions)) throw new Error(cashData.error || "Impossible de charger les caisses.");
      if (!catalogueResponse.ok || !Array.isArray(catalogueData.services) || !Array.isArray(catalogueData.variants)) throw new Error(catalogueData.error || "Impossible de charger le catalogue de vente.");
      setOrders(ordersData.orders);
      setPagination(ordersData.pagination);
      setSaleServices(catalogueData.services);
      setSaleVariants(catalogueData.variants);
      setSessions(cashData.sessions);
      if (!cashData.sessions.some((session) => session.id === sessionId) && cashData.sessions[0]) {
        setSessionId(cashData.sessions[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, pagination.page, pagination.pageSize, appliedFilters]);

  function applyOrderFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setAppliedFilters({ search: search.trim(), status: statusFilter });
    setPagination((current) => ({ ...current, page: 1 }));
  }

  function changeOrderPage(page: number) {
    setLoading(true);
    setPagination((current) => ({ ...current, page }));
  }

  function changeOrderPageSize(pageSize: AdminPageSize) {
    setLoading(true);
    setPagination((current) => ({ ...current, page: 1, pageSize }));
  }

  // Load role-scoped orders and open payment sessions on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Restore this user's unsubmitted sale/payment data from the current tab.
  useEffect(() => {
    if (!staffId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftReady(true);
      return;
    }
    try {
      const saved = sessionStorage.getItem(draftStorageKey);
      if (saved) {
        const draft: unknown = JSON.parse(saved);
        if (typeof draft === "object" && draft !== null) {
          const record = draft as Record<string, unknown>;
          if (typeof record.customerName === "string") setCustomerName(record.customerName);
          if (typeof record.customerEmail === "string") setCustomerEmail(record.customerEmail);
          if (typeof record.category === "string" && categories.some(([key]) => key === record.category)) setCategory(record.category);
          if (typeof record.quoteRequestId === "string") setQuoteRequestId(record.quoteRequestId);
          if (Array.isArray(record.lines) && record.lines.every(isOrderLine)) {
            setLines(record.lines);
          }
          if (typeof record.requestKey === "string") orderRequestKey.current = record.requestKey;
          if (typeof record.paymentRequestKey === "string") paymentRequestKey.current = record.paymentRequestKey;
          if (typeof record.payingOrderId === "string") setSavedPayingOrderId(record.payingOrderId);
          if (typeof record.sessionId === "string") setSessionId(record.sessionId);
          if (typeof record.amounts === "object" && record.amounts !== null) {
            const savedAmounts = record.amounts as Record<string, unknown>;
            setAmounts({
              CASH: typeof savedAmounts.CASH === "string" ? savedAmounts.CASH : "",
              MOBILE_MONEY: typeof savedAmounts.MOBILE_MONEY === "string" ? savedAmounts.MOBILE_MONEY : "",
              BANK_TRANSFER: typeof savedAmounts.BANK_TRANSFER === "string" ? savedAmounts.BANK_TRANSFER : "",
            });
          }
          if (typeof record.references === "object" && record.references !== null) {
            const savedReferences = record.references as Record<string, unknown>;
            setReferences({
              CASH: typeof savedReferences.CASH === "string" ? savedReferences.CASH : "",
              MOBILE_MONEY: typeof savedReferences.MOBILE_MONEY === "string" ? savedReferences.MOBILE_MONEY : "",
              BANK_TRANSFER: typeof savedReferences.BANK_TRANSFER === "string" ? savedReferences.BANK_TRANSFER : "",
            });
          }
          if (record.showForm === true) setShowForm(true);
        }
      }
    } catch (error) {
      console.error("Order draft restore:", error);
      toast.error("Le brouillon de vente n’a pas pu être restauré.");
    } finally {
      setDraftReady(true);
    }
  }, [draftStorageKey, staffId]);

  useEffect(() => {
    if (!draftReady || !staffId) return;
    const hasContent = Boolean(customerName || customerEmail || quoteRequestId || orderRequestKey.current)
      || lines.some((line) => line.description || line.unitPrice || line.serviceId || line.productVariantId);
    const hasPaymentDraft = Boolean(savedPayingOrderId || paymentRequestKey.current
      || Object.values(amounts).some(Boolean) || Object.values(references).some(Boolean));
    try {
      if (!hasContent && !showForm && !hasPaymentDraft) {
        sessionStorage.removeItem(draftStorageKey);
        return;
      }
      sessionStorage.setItem(draftStorageKey, JSON.stringify({
        customerName,
        customerEmail,
        category,
        quoteRequestId,
        lines,
        requestKey: orderRequestKey.current,
        paymentRequestKey: paymentRequestKey.current,
        payingOrderId: payingOrder?.id ?? savedPayingOrderId,
        sessionId,
        amounts,
        references,
        showForm,
      }));
    } catch (error) {
      console.error("Order draft save:", error);
      toast.error("Le brouillon de vente ne peut pas être conservé dans cette session.");
    }
  }, [draftReady, staffId, draftStorageKey, customerName, customerEmail, category, quoteRequestId, lines, showForm, saving, payingOrder, savedPayingOrderId, sessionId, amounts, references]);

  // Resolve a restored payment draft after the role-scoped order list arrives.
  useEffect(() => {
    if (!savedPayingOrderId || orders.length === 0) return;
    const order = orders.find((candidate) => candidate.id === savedPayingOrderId);
    if (order) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPayingOrder(order);
      setSavedPayingOrderId("");
    }
  }, [savedPayingOrderId, orders]);

  async function openNewOrder() {
    setShowForm(true);
    if (role === "ADMIN" && quotes.length === 0) {
      try {
        const response = await fetch("/api/admin/devis", { cache: "no-store" });
        const data: { quotes?: Quote[]; error?: string } = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible de charger les devis.");
        setQuotes((data.quotes ?? []).filter((quote) => quote.status === "ACCEPTED"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Impossible de charger les devis.");
      }
    }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      orderRequestKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/admin/commandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: orderRequestKey.current,
          customerName,
          customerEmail,
          category,
          quoteRequestId: quoteRequestId || undefined,
          lines: lines.map((line) => ({
            quantity: Number(line.quantity),
            ...(line.kind === "CUSTOM" ? {
              description: line.description,
              unitPrice: Number(line.unitPrice),
              category: line.category,
            } : line.kind === "SERVICE"
              ? { serviceId: line.serviceId }
              : { productVariantId: line.productVariantId }),
          })),
        }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de créer la commande.");
      toast.success("Commande et facture créées.");
      orderRequestKey.current = null;
      setShowForm(false);
      setCustomerName(""); setCustomerEmail(""); setQuoteRequestId("");
      setLines([{ kind: "CUSTOM", description: "", quantity: "1", unitPrice: "", category: "OTHER", serviceId: "", productVariantId: "" }]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer la commande.");
    } finally {
      setSaving(false);
    }
  }

  function selectLineKind(index: number, kind: Line["kind"]) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index
      ? { ...line, kind, description: "", unitPrice: "", serviceId: "", productVariantId: "" }
      : line));
  }

  function selectService(index: number, serviceId: string) {
    const service = saleServices.find((option) => option.id === serviceId);
    setLines((current) => current.map((line, lineIndex) => lineIndex === index
      ? {
        ...line,
        serviceId,
        description: service ? `${service.titleFr} · ${service.billingUnit ?? "prestation"}` : "",
        unitPrice: service?.unitPrice.toString() ?? "",
        category: service?.salesCategory ?? "OTHER",
      }
      : line));
  }

  function selectVariant(index: number, productVariantId: string) {
    const variant = saleVariants.find((option) => option.id === productVariantId);
    setLines((current) => current.map((line, lineIndex) => lineIndex === index
      ? {
        ...line,
        productVariantId,
        description: variant ? `${variant.product.nameFr} · ${[variant.color, variant.size].filter(Boolean).join(" / ")}` : "",
        unitPrice: variant?.unitPrice.toString() ?? "",
      }
      : line));
  }


  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payingOrder) return;
    const payments = methods.flatMap(([method]) => {
      const amount = Number(amounts[method as keyof typeof amounts]);
      return amount > 0 ? [{ method, amount, reference: references[method as keyof typeof references] }] : [];
    });
    if (payments.length === 0) {
      toast.error("Saisis au moins un montant à encaisser.");
      return;
    }
    setSaving(true);
    try {
      paymentRequestKey.current ??= crypto.randomUUID();
      const response = await fetch(`/api/admin/commandes/${payingOrder.id}/paiements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: paymentRequestKey.current, sessionId, payments }),
      });
      const data: { error?: string; alreadyRecorded?: boolean } = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer le paiement.");
      toast.success(data.alreadyRecorded ? "Ce paiement avait déjà été enregistré." : "Paiement enregistré et rattaché à la session de caisse.");
      paymentRequestKey.current = null;
      setPayingOrder(null);
      setAmounts({ CASH: "", MOBILE_MONEY: "", BANK_TRANSFER: "" });
      setReferences({ CASH: "", MOBILE_MONEY: "", BANK_TRANSFER: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer le paiement.");
    } finally {
      setSaving(false);
    }
  }

  async function requestRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refundingOrder) return;
    setSaving(true);
    try {
      const endpoint = refundAction === "REVERSAL"
        ? `/api/admin/commandes/${refundingOrder.id}/paiements/${refundPaymentId}/annulation`
        : `/api/admin/commandes/${refundingOrder.id}/remboursements`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refundAction === "REVERSAL"
          ? { sessionId, reason: refundReason }
          : { paymentId: refundPaymentId, sessionId, amount: Number(refundAmount), reason: refundReason }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de demander le remboursement.");
      toast.success(refundAction === "REVERSAL" ? "Annulation validée ou transmise à un responsable." : "Remboursement validé ou transmis à un responsable.");
      setRefundingOrder(null); setRefundAmount(""); setRefundReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de demander le remboursement.");
    } finally {
      setSaving(false);
    }
  }

  const sumLines = lines.reduce((total, line) => total + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div><span className="admin-eyebrow">VENTES · FACTURATION</span><h1>Commandes & factures</h1><p>Crée une vente directe ou convertis un devis accepté. Chaque paiement alimente une session de caisse.</p></div>
        <button type="button" className="admin-primary-button" onClick={() => void openNewOrder()}><Plus size={18} />Nouvelle commande</button>
      </header>
      {showForm && (
        <AdminDialog className="admin-order-dialog" open={showForm} onOpenChange={setShowForm} title="Nouvelle commande" description="Renseignez les coordonnées du client et les lignes à facturer." closeLabel="Fermer le formulaire">
        <form className="admin-dialog-form admin-order-dialog-form" onSubmit={(event) => void createOrder(event)}>
          <div className="admin-order-form-intro"><span className="admin-eyebrow">NOUVELLE VENTE</span><p>Les montants sont en FCFA. La facture sera créée à l’enregistrement.</p></div>
          <div className="admin-form-section"><h3>1. Client et activité</h3><div className="admin-form-grid admin-order-customer-grid">
            <label>Nom du client<input required minLength={2} maxLength={160} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
            <label>E-mail du client (facultatif)<input type="email" maxLength={254} value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></label>
            <label>Type de prestation<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {role === "ADMIN" && <label>Devis accepté (facultatif)<select value={quoteRequestId} onChange={(event) => setQuoteRequestId(event.target.value)}><option value="">Vente directe</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.reference} · {quote.fullName}</option>)}</select></label>}
          </div></div>
          <div className="admin-form-section"><h3>2. Articles et prestations</h3><p>Pour une vente directe de comptoir, utilisez le module Caisse. Les lignes ci-dessous apparaîtront sur la facture client.</p><div className="admin-order-lines">
            {lines.map((line, index) => <div className="admin-order-line" key={index}>
              <div className="admin-order-line-heading"><span className="admin-order-line-number">{String(index + 1).padStart(2, "0")}</span><label>Type de ligne<select value={line.kind} onChange={(event) => selectLineKind(index, event.target.value as Line["kind"])}><option value="CUSTOM">Désignation libre</option><option value="SERVICE">Service tarifé</option><option value="VARIANT">Produit avec variante et stock</option></select></label>{lines.length > 1 && <button type="button" className="admin-icon-button is-danger" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} aria-label="Retirer cette ligne"><X size={17} /></button>}</div>
              {line.kind === "SERVICE" ? (
                <label className="admin-order-line-description">Prestation<select required value={line.serviceId} onChange={(event) => selectService(index, event.target.value)}><option value="">Sélectionner une prestation…</option>{saleServices.map((service) => <option key={service.id} value={service.id}>{service.titleFr} · {money(service.unitPrice)} / {service.billingUnit ?? "prestation"}</option>)}</select></label>
              ) : line.kind === "VARIANT" ? (
                <label className="admin-order-line-description">Produit / variante<select required value={line.productVariantId} onChange={(event) => selectVariant(index, event.target.value)}><option value="">Sélectionner un produit…</option>{saleVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku} · {variant.product.nameFr} · {[variant.color, variant.size].filter(Boolean).join(" / ")} · dispo. {Math.max(0, Number(variant.quantityOnHand) - Number(variant.quantityReserved)).toLocaleString("fr-FR")}</option>)}</select></label>
              ) : (
                <label className="admin-order-line-description">Désignation<input required minLength={2} maxLength={500} value={line.description} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="Ex. Impression de documents" /></label>
              )}
              {line.kind === "CUSTOM" && <label className="admin-order-line-category">Catégorie<select value={line.category} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, category: event.target.value } : item))}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
              <label className="admin-order-line-quantity">Quantité<input required type="number" min={0.001} step="0.001" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item))} /></label>
              <label className="admin-order-line-price">Prix unitaire<input required type="number" min={0} step={1} value={line.unitPrice} readOnly={line.kind !== "CUSTOM"} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, unitPrice: event.target.value } : item))} /></label>
              <div className="admin-order-line-total"><span>Total ligne</span><strong>{money(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</strong></div>
            </div>)}
            <div className="admin-order-lines-footer"><button type="button" className="admin-quiet-button" onClick={() => setLines((current) => [...current, { kind: "CUSTOM", description: "", quantity: "1", unitPrice: "", category: "OTHER", serviceId: "", productVariantId: "" }])}><Plus size={15} />Ajouter une ligne</button><strong>Total estimé : {money(sumLines)}</strong></div>
          </div></div>
          <div className="admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setShowForm(false)}>Annuler</button><button type="submit" className="admin-primary-button" disabled={saving}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <FileText size={17} />}Créer la commande et la facture</button></div>
        </form>
        </AdminDialog>
      )}

      {payingOrder && (
        <AdminDialog open={Boolean(payingOrder)} onOpenChange={(open) => { if (!open) setPayingOrder(null); }} title={`Encaisser ${payingOrder.invoiceNumber}`} description={`Reste à payer : ${money(payingOrder.remainingAmount)}. La somme des moyens ne peut pas dépasser ce solde.`} closeLabel="Fermer l’encaissement">
        <form className="admin-dialog-form" onSubmit={(event) => void recordPayment(event)}>
          <div className="admin-panel-heading"><div><span className="admin-eyebrow">ENCAISSEMENT MIXTE POSSIBLE</span><h2>Encaisser {payingOrder.invoiceNumber}</h2><p>Reste à payer : <strong>{money(payingOrder.remainingAmount)}</strong>. La somme des moyens ne peut pas dépasser ce solde.</p></div><button type="button" className="admin-icon-button" onClick={() => setPayingOrder(null)} aria-label="Fermer"><X size={18} /></button></div>
          <div className="admin-form-grid">
            <label className="admin-form-full">Session de caisse<select required value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Sélectionner…</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.register.name}</option>)}</select></label>
            {methods.map(([method, label]) => <div className="admin-payment-split" key={method}><label>{label}<input type="number" min={0} step={1} value={amounts[method as keyof typeof amounts]} onChange={(event) => setAmounts({ ...amounts, [method]: event.target.value })} /></label>{method !== "CASH" && <label>Référence (facultatif)<input value={references[method as keyof typeof references]} onChange={(event) => setReferences({ ...references, [method]: event.target.value })} /></label>}</div>)}
            <p className="admin-form-full">Total saisi : <strong>{money(Object.values(amounts).reduce((sum, amount) => sum + Number(amount || 0), 0))}</strong></p>
          </div>
          <div className="admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setPayingOrder(null)}>Annuler</button><button type="submit" className="admin-primary-button" disabled={saving || sessions.length === 0}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <ReceiptText size={17} />}Enregistrer le paiement</button></div>
        </form>
        </AdminDialog>
      )}
      {refundingOrder && (
        <AdminDialog open={Boolean(refundingOrder)} onOpenChange={(open) => { if (!open) setRefundingOrder(null); }} title={refundAction === "REVERSAL" ? "Annuler un encaissement" : "Demander un remboursement"} description="Le paiement d’origine est conservé. Le motif et l’approbateur sont journalisés." closeLabel="Fermer le formulaire">
        <form className="admin-dialog-form" onSubmit={(event) => void requestRefund(event)}>
          <div className="admin-panel-heading"><div><span className="admin-eyebrow">AUTORISATION SÉPARÉE</span><h2>{refundAction === "REVERSAL" ? "Annuler un encaissement" : "Demander un remboursement"}</h2><p>Le paiement d’origine est conservé. Le motif et l’approbateur seront journalisés.</p></div><button type="button" className="admin-icon-button" onClick={() => setRefundingOrder(null)} aria-label="Fermer"><X size={18} /></button></div>
          <div className="admin-form-grid">
            <label className="admin-form-full">Session de caisse<select required value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Sélectionner…</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.register.name}</option>)}</select></label>
            <label>Action<select value={refundAction} onChange={(event) => setRefundAction(event.target.value as "REFUND" | "REVERSAL")}><option value="REFUND">Rembourser une partie</option><option value="REVERSAL">Annuler l’encaissement</option></select></label>
            <label>Paiement d’origine<select required value={refundPaymentId} onChange={(event) => setRefundPaymentId(event.target.value)}><option value="">Sélectionner…</option>{refundingOrder.payments.map((payment) => <option key={payment.id} value={payment.id}>{money(payment.amount)} · {payment.method} · {new Date(payment.createdAt).toLocaleDateString("fr-FR")}</option>)}</select></label>
            {refundAction === "REFUND" && <label>Montant à rembourser<input required type="number" min={1} step={1} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /></label>}
            <label className="admin-form-full">Motif obligatoire<textarea required minLength={5} maxLength={2000} rows={3} value={refundReason} onChange={(event) => setRefundReason(event.target.value)} /></label>
          </div>
          <div className="admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setRefundingOrder(null)}>Annuler</button><button type="submit" className="admin-primary-button" disabled={saving || sessions.length === 0}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <ReceiptText size={17} />}Soumettre le remboursement</button></div>
        </form>
        </AdminDialog>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Suivi des commandes</h2><p>{pagination.total} commande(s) correspondante(s) · Factures consultables et imprimables.</p></div></div>
        <form className="admin-order-filters" onSubmit={applyOrderFilters}>
          <label>Recherche<input maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="N° commande, facture, client…" /></label>
          <label>Statut<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tous</option><option value="OPEN">Impayée</option><option value="PARTIALLY_PAID">Partiellement payée</option><option value="PAID">Payée</option><option value="CANCELLED">Annulée</option></select></label>
          <button type="submit" className="admin-quiet-button">Filtrer</button>
        </form>
        {loading ? <div className="admin-empty-state"><LoaderCircle className="animate-spin" />Chargement…</div> : (
          <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Commande · facture</th><th>Client</th><th>Catégorie</th><th>Statut</th><th>Total</th><th>Payé</th><th>Reste</th><th>Actions</th></tr></thead><tbody>
            {orders.map((order) => <tr key={order.id}><td>{order.orderNumber}<small>{order.invoiceNumber} · {new Date(order.createdAt).toLocaleDateString("fr-FR")}</small></td><td>{order.customerName}<small>Par {order.createdBy.fullName}</small></td><td>{categories.find(([value]) => value === order.category)?.[1] ?? order.category}</td><td><span className={`admin-status-pill${order.status === "PAID" ? " is-active" : ""}`}>{order.status === "PAID" ? "Payée" : order.status === "PARTIALLY_PAID" ? "Partiellement payée" : order.status === "CANCELLED" ? "Annulée" : "Impayée"}</span></td><td>{money(order.totalAmount)}</td><td>{money(order.paidAmount)}</td><td>{money(order.remainingAmount)}</td><td><div className="admin-row-actions"><Link className="admin-quiet-button" href={`/${locale}/admin/stock?orderId=${encodeURIComponent(order.id)}`}><Boxes size={15} />Enregistrer mouvement</Link><Link className="admin-quiet-button" href={`/${locale}/admin/factures/${order.id}`} target="_blank"><FileText size={15} />Facture</Link>{order.remainingAmount > 0 && <button type="button" className="admin-primary-button is-compact" onClick={() => { paymentRequestKey.current = null; setPayingOrder(order); }} disabled={sessions.length === 0}>Encaisser</button>}{order.paidAmount > 0 && <button type="button" className="admin-quiet-button" onClick={() => { setRefundingOrder(order); setRefundPaymentId(order.payments[0]?.id ?? ""); }} disabled={sessions.length === 0}>Rembourser</button>}</div></td></tr>)}
            {orders.length === 0 && <tr><td colSpan={8}>Aucune commande pour le moment.</td></tr>}
          </tbody></table></div>
        )}
        {!loading && <AdminPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={changeOrderPage}
          onPageSizeChange={changeOrderPageSize}
        />}
      </section>
    </div>
  );
}
