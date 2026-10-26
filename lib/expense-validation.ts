import { z } from "zod";

export const MAX_EXPENSE_AMOUNT = 2_147_483_647;
export const paymentMethodSchema = z.enum([
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "CARD",
  "CHEQUE",
  "OTHER",
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const expenseInputSchema = z.object({
  categoryId: z.string().min(1).max(100),
  label: z.string().trim().min(2).max(180),
  description: z.string().trim().min(2).max(4000),
  amount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT),
  currency: z.string().regex(/^[A-Z]{3}$/).default("XOF"),
  expenseDate: isoDate,
  dueDate: isoDate.optional().or(z.literal("")),
  invoiceDate: isoDate.optional().or(z.literal("")),
  invoiceNumber: z.string().trim().max(120).optional().or(z.literal("")),
  beneficiary: z.string().trim().min(2).max(180),
  periodStart: isoDate.optional().or(z.literal("")),
  periodEnd: isoDate.optional().or(z.literal("")),
  internalComment: z.string().trim().max(4000).optional().or(z.literal("")),
  details: z.record(z.string(), z.unknown()).optional(),
  initialPayment: z.object({
    amount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT),
    method: paymentMethodSchema,
    paidAt: isoDate.optional().or(z.literal("")),
    reference: z.string().trim().max(120).optional().or(z.literal("")),
    comment: z.string().trim().max(1000).optional().or(z.literal("")),
  }).strict().optional(),
}).strict();

const rentDetailsSchema = z.object({
  ownerName: z.string().trim().min(2).max(180),
  ownerPhone: z.string().trim().max(40).optional().or(z.literal("")),
  ownerContact: z.string().trim().max(300).optional().or(z.literal("")),
  propertyAddress: z.string().trim().min(2).max(500),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "OTHER"]),
  paymentType: z.enum(["ADVANCE", "PARTIAL", "FULL", "DEPOSIT"]),
  observation: z.string().trim().max(2000).optional().or(z.literal("")),
}).strict();

const prepaidElectricitySchema = z.object({
  type: z.literal("PREPAID"),
  provider: z.string().trim().min(2).max(180).default("SBEE"),
  meterNumber: z.string().trim().max(100).optional().or(z.literal("")),
  kilowattHours: z.number().positive().max(1_000_000),
  observation: z.string().trim().max(2000).optional().or(z.literal("")),
}).strict();

const postpaidElectricitySchema = z.object({
  type: z.literal("POSTPAID"),
  provider: z.string().trim().min(2).max(180).default("SBEE"),
  meterNumber: z.string().trim().max(100).optional().or(z.literal("")),
  observation: z.string().trim().max(2000).optional().or(z.literal("")),
}).strict();

const waterDetailsSchema = z.object({
  provider: z.string().trim().min(2).max(180).default("SONEB"),
  meterNumber: z.string().trim().max(100).optional().or(z.literal("")),
  observation: z.string().trim().max(2000).optional().or(z.literal("")),
}).strict();

export function parseCategoryDetails(slug: string, details: unknown) {
  if (slug === "rent") return rentDetailsSchema.safeParse(details);
  if (slug === "electricity") {
    const type = typeof details === "object" && details !== null && "type" in details
      ? (details as { type?: unknown }).type
      : undefined;
    return type === "PREPAID"
      ? prepaidElectricitySchema.safeParse(details)
      : postpaidElectricitySchema.safeParse(details);
  }
  if (slug === "water") return waterDetailsSchema.safeParse(details ?? {});
  return z.record(z.string(), z.unknown()).safeParse(details ?? {});
}

export function validateExpenseCategoryFields(
  slug: string,
  details: object,
  fields: { invoiceNumber?: string | null; invoiceDate?: Date | null; periodStart?: Date | null; periodEnd?: Date | null },
) {
  if (slug === "rent" && (!fields.periodStart || !fields.periodEnd)) {
    return "La période de location doit comporter une date de début et de fin.";
  }
  if (slug === "water" && (!fields.periodStart || !fields.periodEnd)) {
    return "La période facturée par le fournisseur d’eau est obligatoire.";
  }
  if (slug === "electricity" && "type" in details && details.type === "POSTPAID") {
    if (!fields.invoiceNumber || !fields.invoiceDate || !fields.periodStart || !fields.periodEnd) {
      return "Une facture d’électricité postpayée doit comporter sa référence, sa date d’émission et sa période.";
    }
  }
  if (fields.periodStart && fields.periodEnd && fields.periodStart > fields.periodEnd) {
    return "La date de début de période doit précéder sa date de fin.";
  }
  return null;
}

export const expenseListStatusSchema = z.enum([
  "ALL",
  "OPEN",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);
