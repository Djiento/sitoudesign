import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintInvoiceButton from "@/components/admin/PrintInvoiceButton";
import { getStaffSession } from "@/lib/admin-auth";
import { isLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const instant = false;

const money = (amount: number) => new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";

export default async function InvoicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (!staff) redirect(`/${locale}/connexion-admin`);
  const order = await prisma.customerOrder.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      operations: { where: { type: { in: ["REFUND", "REVERSAL"] }, approvalStatus: "APPROVED" }, select: { type: true, amount: true, reason: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!order || (staff.role !== "ADMIN" && order.createdByUserId !== staff.userId)) notFound();
  const refundTotal = order.operations.reduce((sum, operation) => sum + operation.amount, 0);
  const paidTotal = order.payments.reduce((sum, payment) => sum + payment.amount, 0) - refundTotal;
  const remaining = order.totalAmount - paidTotal;
  const categoryLabels: Record<string, string> = {
    GRAPHIC_DESIGN: "Graphisme", PRINTING: "Impression", ADVERTISING: "Supports publicitaires", OTHER: "Autres prestations",
  };
  const methodLabels: Record<string, string> = { CASH: "Espèces", MOBILE_MONEY: "Mobile Money", BANK_TRANSFER: "Virement bancaire" };

  return (
    <main className="admin-invoice-page">
      <div className="admin-invoice-toolbar"><Link href={`/${locale}/admin/commandes`} className="admin-quiet-button">← Retour aux commandes</Link><PrintInvoiceButton /></div>
      <article className="admin-invoice">
        <header className="admin-invoice-header">
          <div><span className="admin-invoice-brand">SITOU DESIGN</span><p>Impression · Design · Communication visuelle</p><p>Bénin · Facturation en FCFA</p></div>
          <div className="admin-invoice-heading"><span>FACTURE</span><h1>{order.invoiceNumber}</h1><p>Commande {order.orderNumber}</p><p>Date : {new Date(order.createdAt).toLocaleDateString("fr-FR")}</p></div>
        </header>
        <section className="admin-invoice-customer"><span>FACTURÉ À</span><strong>{order.customerName}</strong>{order.customerEmail && <span>{order.customerEmail}</span>}{order.customerPhone && <span>{order.customerPhone}</span>}</section>
        {order.notes && <p className="admin-invoice-notes">{order.notes}</p>}
        <table className="admin-invoice-lines"><thead><tr><th>Désignation</th><th>Type</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>{order.lines.map((line) => <tr key={line.id}><td>{line.description}</td><td>{categoryLabels[line.category]}</td><td>{Number(line.quantity).toLocaleString("fr-FR")}</td><td>{money(line.unitPrice)}</td><td>{money(line.total)}</td></tr>)}</tbody></table>
        <div className="admin-invoice-totals"><div><span>Sous-total</span><strong>{money(order.subtotal)}</strong></div>{order.discountAmount > 0 && <div><span>Remise</span><strong>− {money(order.discountAmount)}</strong></div>}<div className="is-total"><span>Total TTC</span><strong>{money(order.totalAmount)}</strong></div></div>
        <section className="admin-invoice-payments"><h2>Règlements</h2>{order.payments.map((payment) => <div key={payment.id}><span>{new Date(payment.createdAt).toLocaleDateString("fr-FR")} · {methodLabels[payment.method]}{payment.reference ? ` · Réf. ${payment.reference}` : ""}</span><strong>{money(payment.amount)}</strong></div>)}{order.operations.map((refund, index) => <div className="is-refund" key={`${order.id}-refund-${index}`}><span>{refund.type === "REVERSAL" ? "Encaissement annulé" : "Remboursement validé"} · {refund.reason}</span><strong>− {money(refund.amount)}</strong></div>)}{order.payments.length === 0 && <p>Aucun règlement reçu.</p>}</section>
        <div className="admin-invoice-balance"><span>{remaining > 0 ? "Reste à payer" : remaining < 0 ? "Trop-perçu" : "Solde réglé"}</span><strong>{money(Math.abs(remaining))}</strong></div>
        <footer className="admin-invoice-footer"><span>Prestation : {categoryLabels[order.category]}</span><span>Établie par {order.createdBy.fullName}</span><span>Merci de votre confiance.</span></footer>
      </article>
    </main>
  );
}
