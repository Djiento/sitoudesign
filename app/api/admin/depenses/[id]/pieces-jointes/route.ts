import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-api";
import { createExpenseAudit, isExpenseManager } from "@/lib/expenses";
import { getSupabaseStorage, SupabaseStorageConfigurationError } from "@/lib/supabase-storage";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const MAX_SIZE = 10 * 1024 * 1024;
const fileTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function validFileSignature(type: string, bytes: Uint8Array) {
  if (type === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === "image/webp") return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(request: Request, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  const expense = await prisma.expense.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!expense) return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
  if (!isExpenseManager(staff.role) && !staff.canApproveExpenses && expense.createdById !== staff.userId) {
    return NextResponse.json({ error: "Tu ne peux ajouter un justificatif qu’à tes propres dépenses." }, { status: 403 });
  }
  let storage: ReturnType<typeof getSupabaseStorage>;
  try {
    storage = getSupabaseStorage();
  } catch (failure) {
    if (!(failure instanceof SupabaseStorageConfigurationError)) throw failure;
    console.error("Expense attachment storage configuration:", failure.message);
    return NextResponse.json({ error: "Le stockage des justificatifs n’est pas configuré." }, { status: 503 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Le formulaire de justificatif est invalide." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Sélectionne un justificatif." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Le justificatif ne doit pas dépasser 10 Mo." }, { status: 413 });
  const extension = fileTypes.get(file.type);
  if (!extension) return NextResponse.json({ error: "Formats acceptés : PDF, JPEG, PNG et WebP." }, { status: 415 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validFileSignature(file.type, bytes)) return NextResponse.json({ error: "Le contenu du fichier ne correspond pas à son format déclaré." }, { status: 415 });

  const path = `expenses/${id}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await storage.client.storage.from(storage.bucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    console.error("Expense attachment upload:", uploadError.message);
    return NextResponse.json({ error: "Échec du téléversement du justificatif." }, { status: 502 });
  }
  try {
    const attachment = await prisma.$transaction(async (transaction) => {
      const created = await transaction.expenseAttachment.create({
        data: {
          expenseId: id,
          storagePath: path,
          fileName: file.name.replace(/[\\/]/g, "_").slice(0, 180) || `justificatif.${extension}`,
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedById: staff.userId,
        },
      });
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: "EXPENSE_ATTACHMENT_UPLOADED",
        targetId: id,
        result: "SUCCESS",
        details: { attachmentId: created.id, fileName: created.fileName, mimeType: created.mimeType, sizeBytes: created.sizeBytes },
      });
      return created;
    });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (failure) {
    const { error: cleanupError } = await storage.client.storage.from(storage.bucket).remove([path]);
    if (cleanupError) console.error("Expense attachment cleanup after database failure:", cleanupError.message);
    console.error("Expense attachment database save:", failure);
    return NextResponse.json({ error: "Le justificatif a été téléversé mais n’a pas pu être enregistré. Réessaie après vérification." }, { status: 500 });
  }
}
