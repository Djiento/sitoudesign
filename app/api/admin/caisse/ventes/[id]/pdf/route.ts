import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
}

export async function GET(_request: Request, context: RouteContext) {
  const staff = await getStaffSession();
  if (!staff || staff.mustChangePassword) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi avant de télécharger le reçu." }, { status: 401 });

  const { id } = await context.params;
  try {
    const sale = await prisma.cashOperation.findUnique({
      where: { id },
      include: {
        actor: { select: { id: true, fullName: true } },
        register: { select: { name: true } },
      },
    });
    if (!sale || sale.type !== "PAYMENT" || !sale.saleDescription) {
      return NextResponse.json({ error: "Vente comptoir introuvable." }, { status: 404 });
    }
    if (staff.role !== "ADMIN" && sale.actorId !== staff.userId) {
      return NextResponse.json({ error: "Tu ne peux télécharger que tes propres reçus de vente." }, { status: 403 });
    }

    await prisma.auditEvent.create({
      data: {
        actorId: staff.userId,
        action: "CASH_COUNTER_SALE_RECEIPT_PRINTED",
        targetType: "CashOperation",
        targetId: sale.id,
        result: "SUCCESS",
        details: { amount: sale.amount, requestKey: sale.requestKey },
      },
    });

    const reference = `VENTE-${sale.occurredAt.toISOString().slice(0, 10).replaceAll("-", "")}-${sale.id.slice(-8).toUpperCase()}`;
    const category = sale.saleCategoryLabel ?? sale.salesCategory ?? "Autre";
    const methodLabels: Record<string, string> = {
      CASH: "Espèces",
      MOBILE_MONEY: "Mobile Money",
      BANK_TRANSFER: "Virement bancaire",
    };
    const date = sale.occurredAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reçu ${escapeHtml(reference)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font: 15px/1.5 Arial, sans-serif; }
    main { max-width: 760px; margin: 35px auto; padding: 32px; border: 1px solid #d7dee8; border-radius: 12px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #172033; }
    h1 { margin: 0 0 4px; font-size: 26px; }
    p { margin: 4px 0; }
    .muted { color: #5d6879; }
    .reference { text-align: right; font-weight: 700; }
    table { width: 100%; margin: 28px 0; border-collapse: collapse; }
    th, td { padding: 12px 10px; border-bottom: 1px solid #d7dee8; text-align: left; }
    th { background: #f2f5f9; }
    .number { text-align: right; white-space: nowrap; }
    .total { margin: 26px 0; padding: 18px; background: #f2f5f9; text-align: right; font-size: 21px; font-weight: 700; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
    .print { display: block; margin: 0 auto 24px; padding: 10px 18px; border: 0; border-radius: 8px; background: #172033; color: white; font-size: 15px; cursor: pointer; }
    @media print { main { max-width: none; margin: 0; padding: 0; border: 0; } .print { display: none; } }
  </style>
</head>
<body>
  <button class="print" onclick="window.print()">Imprimer / enregistrer en PDF</button>
  <main>
    <header>
      <div><h1>Sitou Design</h1><p class="muted">Reçu de vente comptoir</p></div>
      <div class="reference"><div>${escapeHtml(reference)}</div><div class="muted">${escapeHtml(date)}</div></div>
    </header>
    <table>
      <thead><tr><th>Catégorie</th><th>Article / prestation</th><th class="number">Quantité</th><th class="number">Prix unitaire</th><th class="number">Total</th></tr></thead>
      <tbody><tr>
        <td>${escapeHtml(category)}</td>
        <td>${escapeHtml(sale.saleDescription)}</td>
        <td class="number">${Number(sale.saleQuantity ?? 1).toLocaleString("fr-FR")}</td>
        <td class="number">${formatMoney(sale.saleUnitPrice ?? sale.amount)}</td>
        <td class="number">${formatMoney(sale.amount)}</td>
      </tr></tbody>
    </table>
    <div class="total">Total payé : ${formatMoney(sale.amount)}</div>
    <div class="details">
      <p><strong>Mode de paiement</strong><br>${escapeHtml(methodLabels[sale.method ?? ""] ?? "Non précisé")}</p>
      <p><strong>Caisse</strong><br>${escapeHtml(sale.register.name)}</p>
      <p><strong>Caissier</strong><br>${escapeHtml(sale.actor.fullName)}</p>
      <p><strong>Référence</strong><br>${escapeHtml(reference)}</p>
    </div>
    <p class="muted" style="margin-top:32px">Merci pour votre confiance.</p>
  </main>
  <script>window.addEventListener("load", () => window.setTimeout(() => window.print(), 250));</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${reference}.html"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (failure) {
    console.error("Cash sale receipt GET:", failure);
    return NextResponse.json({ error: "Impossible de générer le reçu de vente." }, { status: 500 });
  }
}
