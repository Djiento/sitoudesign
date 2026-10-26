import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-api";
import { isExpenseManager, todayInBenin, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "UTC" }) : "—";
}

export async function GET(_request: Request, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  try {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: true,
        createdBy: { select: { id: true, fullName: true } },
        payments: {
          include: { createdBy: { select: { fullName: true } } },
          orderBy: { paidAt: "asc" },
        },
      },
    });
    if (!expense) return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
    if (!isExpenseManager(staff.role) && expense.createdById !== staff.userId) {
      return NextResponse.json({ error: "Tu ne peux télécharger que les récapitulatifs de tes propres dépenses." }, { status: 403 });
    }
    const paidAmount = expense.payments.reduce((sum, payment) => sum + (payment.isVoided ? 0 : payment.amount), 0);
    const remaining = Math.max(0, expense.amount - paidAmount);
    const today = toValidDate(todayInBenin())!;
    const status = expense.status === "CANCELLED" ? "Annulée"
      : paidAmount >= expense.amount ? "Payée"
        : paidAmount > 0 ? "Partiellement payée"
          : expense.dueDate && expense.dueDate < today ? "En retard" : "À payer";
    const details = expense.details && typeof expense.details === "object" && !Array.isArray(expense.details)
      ? expense.details as Record<string, unknown>
      : {};
    const candidates: Array<[string, unknown]> = [
      ["Type", details.type === "PREPAID" ? "Électricité prépayée" : details.type === "POSTPAID" ? "Électricité postpayée" : null],
      ["Fournisseur", details.provider],
      ["Numéro de compteur", details.meterNumber],
      ["Énergie achetée", typeof details.kilowattHours === "number" ? `${details.kilowattHours} kWh` : null],
      ["Propriétaire", details.ownerName],
      ["Téléphone", details.ownerPhone],
      ["Adresse du local", details.propertyAddress],
      ["Fréquence du loyer", details.frequency],
      ["Type de paiement du loyer", details.paymentType],
      ["Observation", details.observation],
    ];
    const specificFields: Array<[string, string | number]> = [];
    for (const [label, value] of candidates) {
      if (typeof value === "string" || typeof value === "number") specificFields.push([label, value]);
    }
    const detailRows = specificFields.map(([label, value]) =>
      `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`,
    ).join("");
    const paymentRows = expense.payments.map((payment) => `<tr class="${payment.isVoided ? "voided" : ""}">
      <td>${escapeHtml(formatDate(payment.paidAt))}</td><td>${escapeHtml(payment.method)}</td>
      <td>${escapeHtml(payment.createdBy.fullName)}</td><td class="number">${escapeHtml(money(payment.amount, expense.currency))}</td>
      <td>${payment.isVoided ? `${escapeHtml("Corrigé")} — ${escapeHtml(payment.voidReason)}` : escapeHtml(payment.reference || "—")}</td>
    </tr>`).join("");
    const generatedAt = new Date().toLocaleString("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Africa/Porto-Novo",
    });
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Récapitulatif ${escapeHtml(expense.reference)}</title><style>
@page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#182337;font:14px/1.5 Arial,sans-serif}
main{max-width:780px;margin:30px auto;padding:30px;border:1px solid #d9e0e8;border-radius:12px}
.print{display:block;margin:0 auto 20px;padding:11px 20px;border:0;border-radius:8px;background:#172033;color:white;font-weight:700;cursor:pointer}
header{display:flex;justify-content:space-between;gap:20px;align-items:center;border-bottom:2px solid #172033;padding-bottom:18px}
header img{width:64px;height:64px;object-fit:contain}h1{font-size:22px;margin:0}.muted,small{color:#637083}.reference{text-align:right;font-weight:700}
.total{margin:24px 0;padding:18px;background:#f1f4f8;border-radius:8px;text-align:right;font-size:22px;font-weight:700}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 20px;margin-top:18px}.grid div{display:flex;flex-direction:column;gap:3px}
h2{font-size:16px;margin:24px 0 8px}table{width:100%;border-collapse:collapse}td,th{padding:9px 7px;border-bottom:1px solid #d9e0e8;text-align:left}th{background:#f1f4f8}.number{text-align:right;white-space:nowrap}.voided{color:#8b3440;text-decoration:line-through}
.disclaimer{margin:22px 0;padding:12px;background:#fff8e7;border:1px solid #e8d9ac;color:#5d4b21}.signature{margin-top:45px}
@media print{main{max-width:none;margin:0;padding:0;border:0}.print{display:none}}
</style></head><body><button class="print" onclick="window.print()">Imprimer / enregistrer en PDF</button><main>
<header><div><h1><img src="/logo.png" alt="Sitou Design" style="vertical-align:middle;margin-right:10px">Sitou Design</h1><p class="muted">Récapitulatif de dépense — document généré par l’application</p></div><div class="reference"><div>${escapeHtml(expense.reference)}</div><div class="muted">${escapeHtml(generatedAt)}</div></div></header>
<div class="total">${escapeHtml(money(expense.amount, expense.currency))}<div class="muted" style="font-size:13px;font-weight:400">Montant ${expense.isDeposit ? "du dépôt de garantie" : "de la dépense"} · ${escapeHtml(expense.currency)}</div></div>
<section class="grid">
<div><small>Catégorie</small><strong>${escapeHtml(expense.category.nameFr)}</strong></div>
<div><small>Libellé</small><strong>${escapeHtml(expense.label)}</strong></div>
<div><small>Motif / description</small><strong>${escapeHtml(expense.description)}</strong></div>
<div><small>Fournisseur / bénéficiaire</small><strong>${escapeHtml(expense.beneficiary)}</strong></div>
<div><small>Date de dépense</small><strong>${escapeHtml(formatDate(expense.expenseDate))}</strong></div>
<div><small>Date d’échéance</small><strong>${escapeHtml(formatDate(expense.dueDate))}</strong></div>
<div><small>Date d’émission de facture</small><strong>${escapeHtml(formatDate(expense.invoiceDate))}</strong></div>
<div><small>Statut de paiement</small><strong>${escapeHtml(status)}</strong></div>
<div><small>Référence facture / reçu</small><strong>${escapeHtml(expense.invoiceNumber || "—")}</strong></div>
<div><small>Période concernée</small><strong>${escapeHtml(expense.periodStart ? `${formatDate(expense.periodStart)} – ${formatDate(expense.periodEnd)}` : "—")}</strong></div>
<div><small>Mode(s) de paiement</small><strong>${escapeHtml([...new Set(expense.payments.filter((payment) => !payment.isVoided).map((payment) => payment.method))].join(", ") || "—")}</strong></div>
<div><small>Saisie par</small><strong>${escapeHtml(expense.createdBy.fullName)}</strong></div>
${detailRows}
<div><small>Montant effectivement payé</small><strong>${escapeHtml(money(paidAmount, expense.currency))}</strong></div>
<div><small>Solde restant</small><strong>${escapeHtml(money(remaining, expense.currency))}</strong></div>
${expense.internalComment ? `<div style="grid-column:1/-1"><small>Commentaire interne</small><strong>${escapeHtml(expense.internalComment)}</strong></div>` : ""}
</section>
<h2>Historique des paiements fractionnés</h2><table><thead><tr><th>Date</th><th>Mode</th><th>Saisi par</th><th class="number">Montant</th><th>Référence / correction</th></tr></thead><tbody>${paymentRows || `<tr><td colspan="5">Aucun paiement enregistré.</td></tr>`}</tbody></table>
<div class="disclaimer">Ce document est un récapitulatif généré par Sitou Design. Il ne constitue pas une facture officielle ni une preuve de paiement certifiée. Les justificatifs originaux doivent être conservés.</div>
<p class="signature">Visa / signature : ____________________________________</p>
</main></body></html>`;
    await prisma.auditEvent.create({
      data: {
        actorId: staff.userId,
        action: "EXPENSE_PDF_GENERATED",
        targetType: "Expense",
        targetId: expense.id,
        result: "SUCCESS",
        details: { reference: expense.reference, paidAmount, remaining },
      },
    });
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="depense-${expense.reference}.html"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (failure) {
    console.error("Expense summary PDF GET:", failure);
    return NextResponse.json({ error: "Impossible de générer le récapitulatif imprimable." }, { status: 500 });
  }
}
