
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const quoteSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  service: z.string().trim().min(2).max(100),
  quantity: z.number().int().positive().max(10_000_000).optional().nullable(),
  deadline: z.string().optional().or(z.literal("")),
  message: z.string().trim().min(10).max(5000),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = quoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_FORM", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const deadline = data.deadline ? new Date(data.deadline) : null;

    if (deadline && Number.isNaN(deadline.getTime())) {
      return NextResponse.json({ error: "INVALID_DEADLINE" }, { status: 400 });
    }

    const quote = await prisma.quoteRequest.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
        company: data.company || null,
        service: data.service,
        quantity: data.quantity ?? null,
        deadline,
        message: data.message,
        locale: data.locale,
      },
      select: { reference: true, createdAt: true },
    });

    return NextResponse.json(
      {
        success: true,
        reference: quote.reference,
        createdAt: quote.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Quote submission error:", error);
    return NextResponse.json({ error: "QUOTE_SUBMISSION_FAILED" }, { status: 500 });
  }
}