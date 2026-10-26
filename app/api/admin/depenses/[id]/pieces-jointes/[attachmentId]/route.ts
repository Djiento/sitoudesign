import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-api";
import { createExpenseAudit, isExpenseManager } from "@/lib/expenses";
import { getSupabaseStorage, SupabaseStorageConfigurationError } from "@/lib/supabase-storage";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id, attachmentId } = await context.params;
  try {
    const attachment = await prisma.expenseAttachment.findFirst({
      where: { id: attachmentId, expenseId: id },
      include: { expense: { select: { createdById: true } } },
    });
    if (!attachment) return NextResponse.json({ error: "Justificatif introuvable." }, { status: 404 });
    if (!isExpenseManager(staff.role) && !staff.canApproveExpenses && attachment.expense.createdById !== staff.userId) {
      return NextResponse.json({ error: "Tu ne peux consulter que les justificatifs de tes dépenses." }, { status: 403 });
    }
    const storage = getSupabaseStorage();
    const { data, error: signingError } = await storage.client.storage
      .from(storage.bucket)
      .createSignedUrl(attachment.storagePath, 600, { download: attachment.fileName });
    if (signingError) {
      console.error("Expense attachment signed URL:", signingError.message);
      return NextResponse.json({ error: "Impossible de préparer le téléchargement du justificatif." }, { status: 502 });
    }
    await prisma.$transaction(async (transaction) => {
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: "EXPENSE_ATTACHMENT_ACCESSED",
        targetId: id,
        result: "SUCCESS",
        details: { attachmentId, fileName: attachment.fileName },
      });
    });
    return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch (failure) {
    if (failure instanceof SupabaseStorageConfigurationError) {
      console.error("Expense attachment storage configuration:", failure.message);
      return NextResponse.json({ error: "Le stockage des justificatifs n’est pas configuré." }, { status: 503 });
    }
    console.error("Expense attachment GET:", failure);
    return NextResponse.json({ error: "Impossible de télécharger le justificatif." }, { status: 500 });
  }
}
