import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-pagination";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const searchParams = request.nextUrl.searchParams;
  const pagination = parseAdminPagination(searchParams);
  if (!pagination.success) {
    return NextResponse.json({ error: "Les paramètres de pagination sont invalides." }, { status: 400 });
  }

  const targetType = searchParams.get("targetType")?.trim() || undefined;
  const action = searchParams.get("action")?.trim() || undefined;
  const query = searchParams.get("q")?.trim() || undefined;
  if ([targetType, action].some((value) => value && value.length > 100) || (query && query.length > 200)) {
    return NextResponse.json({ error: "Un filtre dépasse la longueur autorisée." }, { status: 400 });
  }

  try {
    const where = {
      ...(targetType ? { targetType } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
      ...(query
        ? {
            OR: [
              { action: { contains: query, mode: "insensitive" as const } },
              { targetType: { contains: query, mode: "insensitive" as const } },
              { targetId: { contains: query, mode: "insensitive" as const } },
              { reason: { contains: query, mode: "insensitive" as const } },
              { actor: { fullName: { contains: query, mode: "insensitive" as const } } },
              { actor: { email: { contains: query, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const total = await prisma.auditEvent.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pagination.data.pageSize));
    const page = Math.min(pagination.data.page, totalPages);
    const events = await prisma.auditEvent.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, email: true, role: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pagination.data.pageSize,
      take: pagination.data.pageSize,
    });
    return NextResponse.json({
      events,
      pagination: { page, pageSize: pagination.data.pageSize, total, totalPages },
    });
  } catch (failure) {
    console.error("Audit log GET:", failure);
    return NextResponse.json({ error: "Impossible de consulter le journal d’audit." }, { status: 500 });
  }
}
