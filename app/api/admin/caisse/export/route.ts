import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function csvCell(value: unknown) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.mustChangePassword) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (staff.role !== "ADMIN" && !staff.canExportReports) return NextResponse.json({ error: "L’export des rapports n’est pas autorisé." }, { status: 403 });
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi avant d’exporter un rapport." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const type = params.get("type");
  const method = params.get("method");
  const orderId = params.get("orderId");
  const cashierId = staff.role === "ADMIN" ? params.get("cashierId") : staff.userId;
  try {
    const operations = await prisma.cashOperation.findMany({
      where: {
        ...(cashierId ? { actorId: cashierId } : {}),
        ...(type ? { type: type as never } : {}),
        ...(method ? { method: method as never } : {}),
        ...(orderId ? { orderId } : {}),
        occurredAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) },
      },
      include: {
        actor: { select: { fullName: true, email: true } },
        register: { select: { name: true, code: true } },
        order: { select: { orderNumber: true, invoiceNumber: true } },
      },
      orderBy: [{ occurredAt: "desc" }],
      take: 10000,
    });
    await prisma.auditEvent.create({
      data: {
        actorId: staff.userId,
        action: "CASH_REPORT_EXPORTED",
        targetType: "CashReport",
        targetId: new Date().toISOString(),
        result: "SUCCESS",
        details: { from, to, type, method, orderId, count: operations.length },
      },
    });
    const rows = [
      ["Date", "Caisse", "Code caisse", "Caissier", "E-mail", "Opération", "Mode", "Désignation", "Catégorie", "Quantité", "Unité", "Prix unitaire FCFA", "Montant FCFA", "Statut d’approbation", "Commande", "Facture", "Motif"],
      ...operations.map((operation) => [
        operation.occurredAt,
        operation.register.name,
        operation.register.code,
        operation.actor.fullName,
        operation.actor.email,
        operation.type,
        operation.method,
        operation.saleDescription,
        operation.saleCategoryLabel ?? operation.salesCategory,
        operation.saleQuantity,
        operation.saleUnit,
        operation.saleUnitPrice,
        operation.amount,
        operation.approvalStatus,
        operation.order?.orderNumber,
        operation.order?.invoiceNumber,
        operation.reason,
      ]),
    ];
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rapport-caisse-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (failure) {
    console.error("Cash report export:", failure);
    return NextResponse.json({ error: "Impossible d’exporter le rapport de caisse." }, { status: 500 });
  }
}
