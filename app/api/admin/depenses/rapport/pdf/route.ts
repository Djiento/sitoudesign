import { NextRequest, NextResponse } from "next/server";
import { ExpensePaymentMethod } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { buildExpenseReport } from "@/lib/expense-reports";
import { prisma } from "@/lib/prisma";

const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  currency: z.string().regex(/^[A-Z]{3}$/).default("XOF"),
  categoryId: z.string().max(100).optional(),
  status: z.enum(["ALL", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).default("ALL"),
  method: z.nativeEnum(ExpensePaymentMethod).optional(),
  beneficiary: z.string().trim().max(180).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function money(value: number, locale: string, currency = "XOF") {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(value);
}

export async function GET(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (staff.role !== "ADMIN" && !staff.canExportReports) {
    return NextResponse.json({ error: "L’export des rapports financiers n’est pas autorisé." }, { status: 403 });
  }
  const parsed = reportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Les filtres du rapport sont invalides." }, { status: 400 });
  const { locale, ...filters } = parsed.data;
  try {
    const report = await buildExpenseReport({
      ...filters,
      userId: staff.role === "CASHIER" ? staff.userId : undefined,
      english: locale === "en",
    });
    await prisma.auditEvent.create({
      data: {
        actorId: staff.userId,
        action: "EXPENSE_REPORT_EXPORTED",
        targetType: "ExpenseReport",
        targetId: `${report.year}-${String(report.month).padStart(2, "0")}`,
        result: "SUCCESS",
        details: { filters: report.filters, locale, invoiceCount: report.invoiceCount, totalPaidThisMonth: report.totalPaidThisMonth },
      },
    });
    const en = locale === "en";
    const monthLabel = new Intl.DateTimeFormat(en ? "en-US" : "fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(report.year, report.month - 1, 1)));
    const generatedAt = report.generatedAt.toLocaleString(en ? "en-US" : "fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Africa/Porto-Novo",
    });
    const rows = report.expenses.map((expense) => `<tr>
      <td>${escapeHtml(expense.reference)}</td>
      <td>${escapeHtml(expense.expenseDate.toLocaleDateString(en ? "en-US" : "fr-FR", { timeZone: "UTC" }))}</td>
      <td>${escapeHtml(expense.categoryName)}</td>
      <td>${escapeHtml(expense.label)}${expense.isDeposit ? ` <small>(${en ? "deposit" : "dépôt"})</small>` : ""}</td>
      <td>${escapeHtml(expense.beneficiary)}</td>
      <td class="number">${money(expense.amount, locale, expense.currency)}</td>
      <td class="number">${money(expense.paidAmount, locale, expense.currency)}</td>
      <td class="number">${money(expense.remainingAmount, locale, expense.currency)}</td>
      <td>${escapeHtml(expense.computedStatus)}</td>
      <td>${escapeHtml(expense.paymentMethods.join(", ") || "—")}</td>
    </tr>`).join("");
    const categoryRows = report.categoryTotals.map((item) =>
      `<tr><td>${escapeHtml(item.categoryName)}</td><td class="number">${money(item.amount, locale, report.currency)}</td></tr>`,
    ).join("");
    const methodRows = report.methodTotals.map((item) =>
      `<tr><td>${escapeHtml(item.method)}</td><td class="number">${money(item.amount, locale, report.currency)}</td></tr>`,
    ).join("");
    const categoryFilter = report.categories.find(({ id }) => id === report.filters.categoryId);
    const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${en ? "Monthly expenses report" : "Rapport mensuel des dépenses"} · ${escapeHtml(monthLabel)}</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#182337;font:12px/1.45 Arial,sans-serif}
main{max-width:1200px;margin:30px auto;padding:24px}.print{display:block;margin:0 auto 20px;padding:11px 20px;border:0;border-radius:8px;background:#172033;color:white;font-weight:700;cursor:pointer}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #172033;padding-bottom:15px;margin-bottom:20px}
header img{width:60px;height:60px;object-fit:contain}h1{margin:0;font-size:24px}h2{margin:22px 0 8px;font-size:16px}.muted{color:#697586}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.summary article{padding:12px;background:#f1f4f8;border-radius:7px}.summary strong{display:block;font-size:17px;margin-top:5px}
table{width:100%;border-collapse:collapse;margin:8px 0 18px}th,td{padding:7px 6px;border-bottom:1px solid #d9e0e8;text-align:left;vertical-align:top}th{background:#eff3f8}.number{text-align:right;white-space:nowrap}
.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.disclaimer{margin-top:25px;padding:11px;border:1px solid #d9e0e8;color:#596579}
@media print{main{max-width:none;margin:0;padding:0}.print{display:none}tr{break-inside:avoid}}
</style></head><body><button class="print" onclick="window.print()">${en ? "Print / save as PDF" : "Imprimer / enregistrer en PDF"}</button><main>
<header><div><h1><img src="/logo.png" alt="Sitou Design" style="vertical-align:middle;margin-right:12px">${en ? "Monthly expenses report" : "Rapport mensuel des dépenses"}</h1><p class="muted">${escapeHtml(monthLabel)} · ${en ? "Generated by" : "Généré par"} ${escapeHtml(staff.fullName)} · ${escapeHtml(generatedAt)}</p></div><strong>Sitou Design</strong></header>
<p>${en ? "Filters" : "Filtres"} : ${escapeHtml(categoryFilter ? (en ? categoryFilter.nameEn : categoryFilter.nameFr) : en ? "all categories" : "toutes catégories")} · ${escapeHtml(report.filters.status)} · ${escapeHtml(report.filters.method || (en ? "all methods" : "tous modes"))}${report.filters.beneficiary ? ` · ${escapeHtml(report.filters.beneficiary)}` : ""}</p>
<section class="summary">
<article>${en ? "Expenses recorded in month" : "Dépenses enregistrées dans le mois"}<strong>${report.recordedCount}</strong></article>
<article>${en ? "Invoices for month" : "Factures relatives au mois"}<strong>${money(report.totalInvoiced, locale, report.currency)}</strong></article>
<article>${en ? "Payments made in month" : "Paiements effectués dans le mois"}<strong>${money(report.totalPaidThisMonth, locale, report.currency)}</strong></article>
<article>${en ? "Outstanding balance" : "Reste à payer"}<strong>${money(report.outstanding, locale, report.currency)}</strong></article>
<article>${en ? "Partial payments" : "Paiements partiels"}<strong>${report.partialCount}</strong></article>
<article>${en ? "Overdue balance" : "Montant en retard"}<strong>${money(report.overdue, locale, report.currency)}</strong></article>
<article>${en ? "Previous month paid" : "Payé le mois précédent"}<strong>${money(report.previousMonthPaid, locale, report.currency)}</strong></article>
<article>${en ? "Security deposits paid (excluded from charges)" : "Dépôts de garantie payés (hors charges)"}<strong>${money(report.depositPaymentsThisMonth, locale, report.currency)}</strong></article>
</section>
<h2>${en ? "Detailed expenses" : "Détail des dépenses"}</h2><table><thead><tr><th>${en ? "Reference" : "Référence"}</th><th>${en ? "Date" : "Date"}</th><th>${en ? "Category" : "Catégorie"}</th><th>${en ? "Description" : "Désignation"}</th><th>${en ? "Beneficiary" : "Bénéficiaire"}</th><th class="number">${en ? "Invoiced" : "Facturé"}</th><th class="number">${en ? "Paid" : "Payé"}</th><th class="number">${en ? "Balance" : "Solde"}</th><th>${en ? "Status" : "Statut"}</th><th>${en ? "Payment method" : "Mode de paiement"}</th></tr></thead><tbody>${rows || `<tr><td colspan="10">${en ? "No expenses match the selected filters." : "Aucune dépense ne correspond aux filtres."}</td></tr>`}</tbody></table>
<div class="columns"><section><h2>${en ? "Invoiced total by category" : "Total facturé par catégorie"}</h2><table><tbody>${categoryRows || `<tr><td>—</td><td>—</td></tr>`}</tbody></table></section><section><h2>${en ? "Payments by method during the month" : "Paiements par mode pendant le mois"}</h2><table><tbody>${methodRows || `<tr><td>—</td><td>—</td></tr>`}</tbody></table></section></div>
<p>${en ? "Total invoiced expenses (excluding security deposits)" : "Total des charges facturées (hors dépôts de garantie)"} : <strong>${money(report.totalInvoiced, locale, report.currency)}</strong></p><p>${en ? "Total actually paid during the month" : "Total réellement payé pendant le mois"} : <strong>${money(report.totalPaidThisMonth, locale, report.currency)}</strong></p>
<div class="disclaimer">${en ? "This document is an application-generated summary. It is not an official invoice or certified proof of payment. Retain the original invoices and payment receipts." : "Ce document est un récapitulatif généré par l’application. Il ne constitue ni une facture officielle ni une preuve de paiement certifiée. Conservez les factures originales et les justificatifs de paiement."}</div>
<p style="margin-top:35px">${en ? "Management approval / signature" : "Visa de la direction / signature"} : ____________________________________</p>
</main></body></html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="rapport-depenses-${report.year}-${String(report.month).padStart(2, "0")}.html"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (failure) {
    console.error("Expense report PDF GET:", failure);
    return NextResponse.json({ error: "Impossible de générer le rapport imprimable." }, { status: 500 });
  }
}
