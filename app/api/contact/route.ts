import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendInquiryEmail } from "@/lib/inquiry-email";

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(5000),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_FORM", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await sendInquiryEmail({ ...parsed.data, kind: "contact" });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Contact notification email failed:", error);
    return NextResponse.json({ error: "CONTACT_EMAIL_FAILED" }, { status: 503 });
  }
}
