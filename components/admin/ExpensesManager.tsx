"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Landmark,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { ExpensePaymentMethod, ExpenseStatus, StaffRole } from "@prisma/client";

type Locale = "fr" | "en";
type Category = { id: string; slug: string; nameFr: string; nameEn: string; isBuiltin?: boolean; isActive?: boolean; sortOrder?: number };
type ExpenseRow = {
  id: string;
  reference: string;
  categoryId: string;
  category: Category;
  label: string;
  description: string;
  amount: number;
  currency: string;
  expenseDate: string;
  dueDate: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  beneficiary: string;
  status: ExpenseStatus | "OVERDUE";
  paidAmount: number;
  remainingAmount: number;
  periodStart: string | null;
  periodEnd: string | null;
  details: Record<string, unknown> | null;
  internalComment: string | null;
  isDeposit: boolean;
  cancellationStatus: string;
  cancellationReason: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string };
  payments?: Payment[];
  attachments?: Attachment[];
  auditEvents?: { id: string; action: string; result: string; occurredAt: string; actor: { fullName: string }; reason: string | null }[];
};
type Payment = {
  id: string;
  amount: number;
  method: ExpensePaymentMethod;
  paidAt: string;
  reference: string | null;
  comment: string | null;
  isVoided: boolean;
  voidReason: string | null;
  createdBy: { fullName: string };
};
type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string };
type Schedule = {
  id: string;
  label: string;
  beneficiary: string;
  categoryId: string;
  category: Category;
  frequency: string;
  customFrequencyDays: number | null;
  nextDueAt: string;
  estimatedAmount: number | null;
  currency: string;
  reminderDays: number;
  details: Record<string, unknown> | null;
  isActive: boolean;
  occurrences: { dueAt: string; expense: { id: string; reference: string; amount: number; status: ExpenseStatus } | null }[];
};
type DashboardData = {
  month: string;
  currency: string;
  metrics: {
    recordedCount: number;
    paidThisMonth: number;
    invoicedThisMonth: number;
    outstanding: number;
    overdue: number;
    partialCount: number;
    previousMonthPaid: number;
    depositsPaidThisMonth: number;
  };
  recordedExcludingDeposits: number;
  categoryTotals: { category: string; amount: number }[];
  topExpenses: ExpenseRow[];
  recentExpenses: ExpenseRow[];
  upcoming: { id: string; label: string; reference: string | null; date: string; amount: number; currency: string; kind: "EXPENSE" | "SCHEDULE"; alert: boolean }[];
  trend: { month: string; amount: number }[];
};
type ExpenseReport = {
  year: number;
  month: number;
  currency: string;
  generatedAt: string;
  recordedCount: number;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaidThisMonth: number;
  depositPaymentsThisMonth: number;
  outstanding: number;
  partialCount: number;
  overdue: number;
  previousMonthPaid: number;
  categoryTotals: { categoryName: string; amount: number }[];
  expenses: (ExpenseRow & { categoryName: string; computedStatus: string; paymentMethods: ExpensePaymentMethod[] })[];
  categories: Category[];
};
type ExpenseForm = {
  categoryId: string;
  label: string;
  description: string;
  amount: string;
  currency: string;
  expenseDate: string;
  dueDate: string;
  invoiceDate: string;
  invoiceNumber: string;
  beneficiary: string;
  periodStart: string;
  periodEnd: string;
  internalComment: string;
  details: Record<string, unknown>;
  initialPaymentAmount: string;
  initialPaymentMethod: ExpensePaymentMethod;
  initialPaymentDate: string;
};

const methodValues: ExpensePaymentMethod[] = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"];
const frequencies = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"] as const;
const statuses = ["ALL", "OPEN", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"] as const;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "La demande n’a pas abouti.");
  return data as T;
}

function formatMoney(amount: number, currency = "XOF", locale: Locale = "fr") {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
      style: "currency", currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR").format(amount)} ${currency}`;
  }
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    dateStyle: "medium", timeZone: "UTC",
  }).format(new Date(value));
}

function categoryLabel(category: Category, locale: Locale) {
  return locale === "en" ? category.nameEn : category.nameFr;
}

function methodLabel(method: string, locale: Locale) {
  const labels: Record<string, [string, string]> = {
    CASH: ["Espèces", "Cash"],
    MOBILE_MONEY: ["Mobile Money", "Mobile Money"],
    BANK_TRANSFER: ["Virement bancaire", "Bank transfer"],
    CARD: ["Carte", "Card"],
    CHEQUE: ["Chèque", "Cheque"],
    OTHER: ["Autre", "Other"],
  };
  return labels[method]?.[locale === "en" ? 1 : 0] ?? method;
}

function statusLabel(status: string, locale: Locale) {
  const labels: Record<string, [string, string]> = {
    UNPAID: ["À payer", "Unpaid"],
    OPEN: ["À payer / partiellement payée", "Unpaid / partially paid"],
    PARTIALLY_PAID: ["Partiellement payée", "Partially paid"],
    PAID: ["Payée", "Paid"],
    OVERDUE: ["En retard", "Overdue"],
    CANCELLED: ["Annulée", "Cancelled"],
  };
  return labels[status]?.[locale === "en" ? 1 : 0] ?? status;
}

function inputClass() {
  return "admin-expense-input";
}

function statusClass(status: string) {
  return `admin-expense-status is-${status.toLowerCase().replaceAll("_", "-")}`;
}

function categoryDetailsDefaults(slug: string): Record<string, unknown> {
  if (slug === "rent") return { ownerName: "", ownerPhone: "", ownerContact: "", propertyAddress: "", frequency: "MONTHLY", paymentType: "FULL", observation: "" };
  if (slug === "electricity") return { type: "POSTPAID", provider: "SBEE", meterNumber: "", kilowattHours: "", observation: "" };
  if (slug === "water") return { provider: "SONEB", meterNumber: "", observation: "" };
  return {};
}

function defaultExpenseForm(categoryId = "", slug = ""): ExpenseForm {
  const date = localDate();
  return {
    categoryId, label: "", description: "", amount: "", currency: "XOF",
    expenseDate: date, dueDate: "", invoiceDate: "", invoiceNumber: "",
    beneficiary: "", periodStart: "", periodEnd: "", internalComment: "",
    details: categoryDetailsDefaults(slug), initialPaymentAmount: "",
    initialPaymentMethod: "CASH", initialPaymentDate: date,
  };
}

export default function ExpensesManager({
  locale,
  role,
  canApproveExpenses,
  canExportReports,
}: {
  locale: Locale;
  role: StaffRole;
  canApproveExpenses: boolean;
  canExportReports: boolean;
}) {
  const en = locale === "en";
  const manager = role === "ADMIN" || role === "MANAGER";
  const canApprove = manager || canApproveExpenses;
  const canExport = role === "ADMIN" || canExportReports;
  const [tab, setTab] = useState<"dashboard" | "expenses" | "schedules" | "reports" | "categories">("dashboard");
  const [categories, setCategories] = useState<Category[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [currency, setCurrency] = useState("XOF");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [listCurrency, setListCurrency] = useState("XOF");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(defaultExpenseForm());
  const [selected, setSelected] = useState<ExpenseRow | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("CASH");
  const [paymentDate, setPaymentDate] = useState(localDate());
  const [paymentComment, setPaymentComment] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({ slug: "", nameFr: "", nameEn: "", sortOrder: "100" });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleEditingId, setScheduleEditingId] = useState<string | null>(null);
  const [scheduleActive, setScheduleActive] = useState(true);
  const [scheduleDraft, setScheduleDraft] = useState({
    categoryId: "", label: "", beneficiary: "", frequency: "MONTHLY",
    customFrequencyDays: "", nextDueAt: localDate(), estimatedAmount: "",
    currency: "XOF", reminderDays: "7", details: {} as Record<string, unknown>,
  });
  const [occurrenceSchedule, setOccurrenceSchedule] = useState<Schedule | null>(null);
  const [occurrenceDraft, setOccurrenceDraft] = useState({
    amount: "", invoiceNumber: "", invoiceDate: "", periodStart: "", periodEnd: "",
    initialPaymentAmount: "", initialPaymentMethod: "CASH" as ExpensePaymentMethod,
  });
  const [reportFilters, setReportFilters] = useState({
    year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1),
    currency: "XOF", categoryId: "", status: "ALL", method: "", beneficiary: "",
  });
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const selectedCategory = form.categoryId ? categoryById.get(form.categoryId) : undefined;
  const scheduleCategory = scheduleDraft.categoryId ? categoryById.get(scheduleDraft.categoryId) : undefined;

  const loadCategories = useCallback(async () => {
    const data = await apiRequest<{ categories: Category[] }>("/api/admin/depenses/categories");
    setCategories(data.categories);
    return data.categories;
  }, []);

  const loadDashboard = useCallback(async (selectedMonth: string, selectedCurrency: string) => {
    const data = await apiRequest<DashboardData>(`/api/admin/depenses/dashboard?month=${encodeURIComponent(selectedMonth)}&currency=${encodeURIComponent(selectedCurrency)}&locale=${locale}`);
    setDashboard(data);
  }, [locale]);

  const loadExpenseList = useCallback(async (selectedPage = 1) => {
    const params = new URLSearchParams({
      page: String(selectedPage), pageSize: "15", search, status: statusFilter,
    });
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (listCurrency !== "ALL") params.set("currency", listCurrency);
    const data = await apiRequest<{ expenses: ExpenseRow[]; page: number; pageCount: number; total: number }>(`/api/admin/depenses?${params}`);
    setExpenses(data.expenses);
    setPage(data.page);
    setPageCount(Math.max(1, data.pageCount));
    setTotal(data.total);
  }, [categoryFilter, listCurrency, search, statusFilter]);

  const loadSchedules = useCallback(async () => {
    const data = await apiRequest<{ schedules: Schedule[] }>("/api/admin/depenses/echeances");
    setSchedules(data.schedules);
  }, []);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The initial API requests populate the module's remote data.
    Promise.all([loadCategories(), loadSchedules()])
      .catch((failure: unknown) => {
        if (!active) return;
        const message = failure instanceof Error ? failure.message : "Impossible de charger le module.";
        setErrorText(message);
        toast.error(message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadCategories, loadSchedules]);

  useEffect(() => {
    if (!loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Load server data when the selected reporting month changes.
      loadDashboard(month, currency).catch((failure: unknown) => toast.error(failure instanceof Error ? failure.message : "Erreur de chargement."));
    }
  }, [month, currency, loading, loadDashboard]);

  useEffect(() => {
    if (!loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Load server data after expense filters change.
      loadExpenseList(1).catch((failure: unknown) => toast.error(failure instanceof Error ? failure.message : "Erreur de chargement."));
    }
  }, [categoryFilter, listCurrency, search, statusFilter, loading, loadExpenseList]);

  const openCreate = () => {
    const first = categories.find((category) => category.isActive !== false);
    setEditingId(null);
    setForm(defaultExpenseForm(first?.id ?? "", first?.slug ?? ""));
    setFormOpen(true);
  };

  const openEdit = (expense: ExpenseRow) => {
    const details = expense.details ?? {};
    setEditingId(expense.id);
    setForm({
      categoryId: expense.categoryId,
      label: expense.label,
      description: expense.description,
      amount: String(expense.amount),
      currency: expense.currency,
      expenseDate: expense.expenseDate.slice(0, 10),
      dueDate: expense.dueDate?.slice(0, 10) ?? "",
      invoiceDate: expense.invoiceDate?.slice(0, 10) ?? "",
      invoiceNumber: expense.invoiceNumber ?? "",
      beneficiary: expense.beneficiary,
      periodStart: expense.periodStart?.slice(0, 10) ?? "",
      periodEnd: expense.periodEnd?.slice(0, 10) ?? "",
      internalComment: expense.internalComment ?? "",
      details: { ...categoryDetailsDefaults(expense.category.slug), ...details },
      initialPaymentAmount: "",
      initialPaymentMethod: "CASH",
      initialPaymentDate: localDate(),
    });
    setSelected(null);
    setFormOpen(true);
  };

  const setDetail = (key: string, value: string | number) => {
    setForm((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  };

  const onSaveExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const amount = Number(form.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      toast.error(en ? "Enter a positive whole-number amount." : "Saisis un montant positif sans décimales.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        categoryId: form.categoryId,
        label: form.label,
        description: form.description,
        amount,
        currency: form.currency,
        expenseDate: form.expenseDate,
        dueDate: form.dueDate,
        invoiceDate: form.invoiceDate,
        invoiceNumber: form.invoiceNumber,
        beneficiary: form.beneficiary,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        internalComment: form.internalComment,
        details: form.details,
      };
      if (!editingId && form.initialPaymentAmount) {
        payload.initialPayment = {
          amount: Number(form.initialPaymentAmount),
          method: form.initialPaymentMethod,
          paidAt: form.initialPaymentDate,
        };
      }
      await apiRequest(editingId ? `/api/admin/depenses/${editingId}` : "/api/admin/depenses", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setFormOpen(false);
      toast.success(en ? "Expense saved." : "Dépense enregistrée.");
      await Promise.all([loadExpenseList(1), loadDashboard(month, currency), loadSchedules()]);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not save the expense." : "Impossible d’enregistrer la dépense.");
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (expense: ExpenseRow) => {
    try {
      const data = await apiRequest<{ expense: ExpenseRow; auditEvents: NonNullable<ExpenseRow["auditEvents"]> }>("/api/admin/depenses/" + expense.id);
      setSelected({ ...data.expense, auditEvents: data.auditEvents });
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Impossible de charger le détail.");
    }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    try {
      await apiRequest(`/api/admin/depenses/${selected.id}/paiements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          method: paymentMethod,
          paidAt: paymentDate,
          comment: paymentComment,
        }),
      });
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentComment("");
      toast.success(en ? "Payment recorded." : "Paiement enregistré.");
      const data = await apiRequest<{ expense: ExpenseRow; auditEvents: NonNullable<ExpenseRow["auditEvents"]> }>("/api/admin/depenses/" + selected.id);
      setSelected({ ...data.expense, auditEvents: data.auditEvents });
      await Promise.all([loadExpenseList(), loadDashboard(month, currency)]);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not record the payment." : "Impossible d’enregistrer le paiement.");
    } finally {
      setSaving(false);
    }
  };

  const submitCancellation = async (decision: "REQUEST" | "APPROVE" | "REJECT", reason = cancelReason) => {
    if (!selected || saving) return;
    if (!window.confirm(en ? "Confirm this cancellation action?" : "Confirmer cette action d’annulation ?")) return;
    setSaving(true);
    try {
      await apiRequest(`/api/admin/depenses/${selected.id}/annulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      setCancelReason("");
      toast.success(decision === "REJECT" ? (en ? "Cancellation rejected." : "Annulation refusée.")
        : decision === "REQUEST" && !manager ? (en ? "Cancellation submitted for approval." : "Demande d’annulation transmise.")
          : (en ? "Expense cancelled." : "Dépense annulée."));
      const data = await apiRequest<{ expense: ExpenseRow; auditEvents: NonNullable<ExpenseRow["auditEvents"]> }>("/api/admin/depenses/" + selected.id);
      setSelected({ ...data.expense, auditEvents: data.auditEvents });
      await Promise.all([loadExpenseList(), loadDashboard(month, currency)]);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not process cancellation." : "Impossible de traiter l’annulation.");
    } finally {
      setSaving(false);
    }
  };

  const voidPayment = async (payment: Payment) => {
    if (!selected || !window.confirm(en ? "Correct this payment? This action is audited." : "Corriger ce paiement ? L’action sera inscrite à l’audit.")) return;
    const reason = window.prompt(en ? "Correction reason" : "Motif de correction");
    if (!reason?.trim()) return;
    setSaving(true);
    try {
      await apiRequest(`/api/admin/depenses/${selected.id}/paiements/${payment.id}/annuler`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
      });
      const data = await apiRequest<{ expense: ExpenseRow; auditEvents: NonNullable<ExpenseRow["auditEvents"]> }>("/api/admin/depenses/" + selected.id);
      setSelected({ ...data.expense, auditEvents: data.auditEvents });
      toast.success(en ? "Payment corrected." : "Paiement corrigé.");
      await Promise.all([loadExpenseList(), loadDashboard(month, currency)]);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not correct payment." : "Impossible de corriger le paiement.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAttachment = async (file: File | undefined) => {
    if (!selected || !file || attachmentBusy) return;
    setAttachmentBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      await apiRequest(`/api/admin/depenses/${selected.id}/pieces-jointes`, { method: "POST", body });
      const data = await apiRequest<{ expense: ExpenseRow; auditEvents: NonNullable<ExpenseRow["auditEvents"]> }>("/api/admin/depenses/" + selected.id);
      setSelected({ ...data.expense, auditEvents: data.auditEvents });
      toast.success(en ? "Supporting document uploaded." : "Justificatif téléversé.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Upload failed." : "Échec du téléversement.");
    } finally {
      setAttachmentBusy(false);
    }
  };

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const activeState = categoryEditingId
        ? categories.find((category) => category.id === categoryEditingId)?.isActive !== false
        : true;
      const categoryPayload = {
        nameFr: categoryDraft.nameFr,
        nameEn: categoryDraft.nameEn,
        sortOrder: Number(categoryDraft.sortOrder),
        isActive: activeState,
        ...(categoryEditingId ? {} : { slug: categoryDraft.slug }),
      };
      await apiRequest(categoryEditingId ? `/api/admin/depenses/categories/${categoryEditingId}` : "/api/admin/depenses/categories", {
        method: categoryEditingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryPayload),
      });
      setCategoryEditingId(null);
      setCategoryDraft({ slug: "", nameFr: "", nameEn: "", sortOrder: "100" });
      setCategoryOpen(false);
      await loadCategories();
      toast.success(en ? "Category created." : "Catégorie créée.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not create category." : "Impossible de créer la catégorie.");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (category: Category) => {
    try {
      await apiRequest(`/api/admin/depenses/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameFr: category.nameFr, nameEn: category.nameEn,
          sortOrder: category.sortOrder ?? 0, isActive: category.isActive === false,
        }),
      });
      await loadCategories();
      toast.success(en ? "Category updated." : "Catégorie mise à jour.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not update category." : "Impossible de modifier la catégorie.");
    }
  };

  const openNewSchedule = () => {
    const first = categories.find((category) => category.isActive !== false);
    setScheduleEditingId(null);
    setScheduleActive(true);
    setScheduleDraft({
      categoryId: first?.id ?? "", label: "", beneficiary: "", frequency: "MONTHLY",
      customFrequencyDays: "", nextDueAt: localDate(), estimatedAmount: "",
      currency: "XOF", reminderDays: "7", details: categoryDetailsDefaults(first?.slug ?? ""),
    });
    setScheduleOpen(true);
  };

  const openEditSchedule = (schedule: Schedule) => {
    setScheduleEditingId(schedule.id);
    setScheduleActive(schedule.isActive);
    setScheduleDraft({
      categoryId: schedule.categoryId,
      label: schedule.label,
      beneficiary: schedule.beneficiary,
      frequency: schedule.frequency,
      customFrequencyDays: schedule.customFrequencyDays ? String(schedule.customFrequencyDays) : "",
      nextDueAt: schedule.nextDueAt.slice(0, 10),
      estimatedAmount: schedule.estimatedAmount ? String(schedule.estimatedAmount) : "",
      currency: schedule.currency,
      reminderDays: String(schedule.reminderDays),
      details: { ...categoryDetailsDefaults(schedule.category.slug), ...(schedule.details ?? {}) },
    });
    setScheduleOpen(true);
  };

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        categoryId: scheduleDraft.categoryId, label: scheduleDraft.label, beneficiary: scheduleDraft.beneficiary,
        frequency: scheduleDraft.frequency,
        customFrequencyDays: scheduleDraft.frequency === "CUSTOM" ? Number(scheduleDraft.customFrequencyDays) : undefined,
        nextDueAt: scheduleDraft.nextDueAt,
        estimatedAmount: scheduleDraft.estimatedAmount ? Number(scheduleDraft.estimatedAmount) : undefined,
        currency: scheduleDraft.currency, reminderDays: Number(scheduleDraft.reminderDays),
        details: scheduleDraft.details, isActive: true,
      };
      await apiRequest(scheduleEditingId ? `/api/admin/depenses/echeances/${scheduleEditingId}` : "/api/admin/depenses/echeances", {
        method: scheduleEditingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, isActive: scheduleActive }),
      });
      setScheduleOpen(false);
      setScheduleEditingId(null);
      await Promise.all([loadSchedules(), loadDashboard(month, currency)]);
      toast.success(en ? "Due date saved. No expense has been created yet." : "Échéance enregistrée. Aucune dépense n’a été créée.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not save schedule." : "Impossible d’enregistrer l’échéance.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSchedule = async (schedule: Schedule) => {
    try {
      await apiRequest(`/api/admin/depenses/echeances/${schedule.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: schedule.categoryId, label: schedule.label, beneficiary: schedule.beneficiary,
          frequency: schedule.frequency, customFrequencyDays: schedule.customFrequencyDays ?? undefined,
          nextDueAt: schedule.nextDueAt.slice(0, 10), estimatedAmount: schedule.estimatedAmount ?? undefined,
          currency: schedule.currency, reminderDays: schedule.reminderDays,
          details: schedule.details ?? {}, isActive: !schedule.isActive,
        }),
      });
      await Promise.all([loadSchedules(), loadDashboard(month, currency)]);
      toast.success(en ? "Due date updated." : "Échéance mise à jour.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not update due date." : "Impossible de modifier l’échéance.");
    }
  };

  const recordOccurrence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!occurrenceSchedule || saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        dueAt: occurrenceSchedule.nextDueAt.slice(0, 10),
        amount: Number(occurrenceDraft.amount),
        invoiceNumber: occurrenceDraft.invoiceNumber,
        invoiceDate: occurrenceDraft.invoiceDate,
        periodStart: occurrenceDraft.periodStart,
        periodEnd: occurrenceDraft.periodEnd,
      };
      if (occurrenceDraft.initialPaymentAmount) {
        payload.initialPayment = {
          amount: Number(occurrenceDraft.initialPaymentAmount),
          method: occurrenceDraft.initialPaymentMethod,
        };
      }
      await apiRequest(`/api/admin/depenses/echeances/${occurrenceSchedule.id}/enregistrer`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      setOccurrenceSchedule(null);
      setOccurrenceDraft({ amount: "", invoiceNumber: "", invoiceDate: "", periodStart: "", periodEnd: "", initialPaymentAmount: "", initialPaymentMethod: "CASH" });
      await Promise.all([loadSchedules(), loadExpenseList(1), loadDashboard(month, currency)]);
      toast.success(en ? "Actual expense recorded; the next due date was advanced." : "Dépense réelle enregistrée ; la prochaine échéance a été avancée.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not record occurrence." : "Impossible d’enregistrer l’échéance.");
    } finally {
      setSaving(false);
    }
  };

  const loadReport = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const params = new URLSearchParams({
      year: reportFilters.year, month: reportFilters.month, currency: reportFilters.currency, status: reportFilters.status, locale,
    });
    if (reportFilters.categoryId) params.set("categoryId", reportFilters.categoryId);
    if (reportFilters.method) params.set("method", reportFilters.method);
    if (reportFilters.beneficiary) params.set("beneficiary", reportFilters.beneficiary);
    try {
      const data = await apiRequest<ExpenseReport>(`/api/admin/depenses/rapport?${params}`);
      setReport(data);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : en ? "Could not build the report." : "Impossible de générer le rapport.");
    }
  };

  const reportUrl = useMemo(() => {
    const params = new URLSearchParams({
      year: reportFilters.year, month: reportFilters.month, currency: reportFilters.currency, status: reportFilters.status, locale,
    });
    if (reportFilters.categoryId) params.set("categoryId", reportFilters.categoryId);
    if (reportFilters.method) params.set("method", reportFilters.method);
    if (reportFilters.beneficiary) params.set("beneficiary", reportFilters.beneficiary);
    return `/api/admin/depenses/rapport/pdf?${params}`;
  }, [locale, reportFilters]);

  const currentDetailSlug = selectedCategory?.slug ?? "";
  const paymentMethodsOptions = methodValues.map((method) => (
    <option key={method} value={method}>{methodLabel(method, locale)}</option>
  ));
  const monthTrend = dashboard?.trend.map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat(en ? "en-US" : "fr-FR", { month: "short", timeZone: "UTC" })
      .format(new Date(`${item.month}-01T00:00:00.000Z`)),
  })) ?? [];

  return (
    <div className="admin-content admin-expenses-page">
      <header className="admin-welcome">
        <div>
          <span className="admin-eyebrow">{en ? "FINANCE · ADMIN" : "FINANCES · ADMINISTRATION"}</span>
          <h1>{en ? "Bills & due dates" : "Factures & échéances"}</h1>
          <p>{en ? "Track actual expenses, split payments and upcoming due dates." : "Suivez les dépenses réelles, les paiements fractionnés et les prochaines échéances."}</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={openCreate}>
          <Plus size={16} /> {en ? "New expense" : "Nouvelle dépense"}
        </button>
      </header>

      <nav className="admin-expense-tabs" aria-label={en ? "Finance sections" : "Rubriques financières"}>
        {([
          ["dashboard", en ? "Overview" : "Vue d’ensemble", BarChart3],
          ["expenses", en ? "Expenses" : "Dépenses", ReceiptText],
          ["schedules", en ? "Due dates" : "Échéances", CalendarClock],
          ["reports", en ? "Reports" : "Rapports", FileText],
          ...(manager ? [["categories", en ? "Categories" : "Catégories", Settings2] as const] : []),
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {errorText && <div className="admin-expense-error" role="alert"><AlertTriangle size={16} /> {errorText}</div>}
      {loading ? (
        <div className="admin-expense-loading"><LoaderCircle size={22} className="is-spinning" /> {en ? "Loading financial data…" : "Chargement des données financières…"}</div>
      ) : (
        <>
          {tab === "dashboard" && (
            <section className="admin-expense-dashboard">
              <div className="admin-expense-period">
                <label>{en ? "Period" : "Période"} <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
                <label>{en ? "Currency" : "Devise"} <input className={inputClass()} maxLength={3} pattern="[A-Z]{3}" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
                <span>{en ? "Charges use invoices; cash flow uses confirmed payments only." : "Les charges reposent sur les factures ; la trésorerie ne compte que les paiements confirmés."}</span>
              </div>
              {dashboard && (
                <>
                  <p className="admin-expense-period-count">{en ? "Expenses recorded this month" : "Dépenses saisies ce mois"} : <strong>{dashboard.recordedExcludingDeposits}</strong> · {en ? "Paid cash outflows" : "Sorties réellement payées"} : <strong>{formatMoney(dashboard.metrics.paidThisMonth, currency, locale)}</strong></p>
                  <div className="admin-finance-kpis">
                    {[
                      { label: en ? "Paid this month" : "Payé ce mois", value: formatMoney(dashboard.metrics.paidThisMonth, currency, locale), tone: "green", note: en ? "Real payments" : "Paiements enregistrés", status: "PAID", tab: "expenses" as const },
                      { label: en ? "Bills awaiting payment" : "Factures à régler", value: formatMoney(dashboard.metrics.outstanding, currency, locale), tone: "orange", note: `${dashboard.metrics.partialCount} ${en ? "partial" : "partielle(s)"}`, status: "OPEN", tab: "expenses" as const },
                      { label: en ? "Overdue balance" : "Échéances en retard", value: formatMoney(dashboard.metrics.overdue, currency, locale), tone: "red", note: en ? "Unpaid due dates" : "Échéances impayées", status: "OVERDUE", tab: "expenses" as const },
                      { label: en ? "Invoices for period" : "Factures de la période", value: formatMoney(dashboard.metrics.invoicedThisMonth, currency, locale), tone: "blue", note: en ? "Deposits excluded" : "Dépôts exclus des charges", status: "ALL", tab: "reports" as const },
                    ].map((metric) => (
                      <article className={`admin-finance-kpi is-${metric.tone}`} key={metric.label}>
                        <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small>
                        <button type="button" className="admin-expense-kpi-link" onClick={() => {
                          setTab(metric.tab);
                          setListCurrency(currency);
                          setStatusFilter(metric.status);
                          if (metric.tab === "reports") setReportFilters({ ...reportFilters, year: month.slice(0, 4), month: String(Number(month.slice(5, 7))), currency, status: "ALL" });
                        }}>{en ? "View details" : "Voir le détail"} <ChevronRight size={13} /></button>
                      </article>
                    ))}
                  </div>
                  <div className="admin-expense-dashboard-grid">
                    <section className="admin-panel">
                      <div className="admin-panel-heading"><div><h2>{en ? "Actual monthly payments" : "Paiements réellement effectués"}</h2><p>{en ? "Recorded cash outflows over the last six months." : "Sorties de trésorerie enregistrées sur les six derniers mois."}</p></div></div>
                      {monthTrend.some((point) => point.amount > 0) ? (
                        <div className="admin-expense-chart" role="img" aria-label={en ? "Monthly expenses paid" : "Dépenses payées par mois"}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthTrend} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                              <CartesianGrid stroke="var(--admin-chart-grid)" vertical={false} />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--admin-chart-label)", fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: "var(--admin-chart-label)", fontSize: 9 }} tickFormatter={(value: number) => new Intl.NumberFormat(en ? "en-US" : "fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
                              <Tooltip formatter={(value) => [formatMoney(Number(value), currency, locale), en ? "Paid" : "Payé"]} />
                              <Bar dataKey="amount" fill="var(--admin-accent)" radius={[5, 5, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <p className="admin-expense-empty">{en ? "No recorded payments for this period." : "Aucun paiement enregistré sur cette période."}</p>}
                    </section>
                    <section className="admin-panel">
                      <div className="admin-panel-heading"><div><h2>{en ? "Invoices by category" : "Factures par catégorie"}</h2><p>{en ? "Real recorded invoices for the selected month." : "Factures réelles enregistrées pour le mois sélectionné."}</p></div></div>
                      {dashboard.categoryTotals.length ? dashboard.categoryTotals.map((item) => (
                        <div className="admin-expense-category-total" key={item.category}>
                          <span>{item.category}</span><strong>{formatMoney(item.amount, currency, locale)}</strong>
                        </div>
                      )) : <p className="admin-expense-empty">{en ? "No invoices for this period." : "Aucune facture sur cette période."}</p>}
                    </section>
                  </div>
                  <div className="admin-expense-dashboard-grid">
                    <section className="admin-panel">
                      <div className="admin-panel-heading"><div><h2>{en ? "Upcoming due dates" : "Prochaines échéances"}</h2><p>{en ? "Recurring schedules are forecasts, not paid expenses." : "Les récurrences sont des prévisions, pas des dépenses déjà payées."}</p></div><button className="admin-inline-link" onClick={() => setTab("schedules")}>{en ? "Manage" : "Gérer"} <ChevronRight size={14} /></button></div>
                      {dashboard.upcoming.length ? dashboard.upcoming.map((item) => (
                        <div className="admin-expense-upcoming" key={`${item.kind}-${item.id}`}>
                          <span className={`admin-expense-upcoming-icon${item.kind === "SCHEDULE" ? " is-schedule" : ""}`}>{item.kind === "SCHEDULE" ? <CalendarClock size={16} /> : <ReceiptText size={16} />}</span>
                          <span className="admin-expense-upcoming-main"><strong>{item.label}</strong><small>{item.reference ?? (en ? "Forecast" : "Prévision")} · {formatDate(item.date, locale)}</small></span>
                          <span className="admin-expense-upcoming-end">{item.alert && <small className="admin-expense-alert">{en ? "Due soon" : "Échéance proche"}</small>}<strong>{formatMoney(item.amount, item.currency, locale)}</strong></span>
                        </div>
                      )) : <p className="admin-expense-empty">{en ? "No upcoming due dates." : "Aucune échéance à venir."}</p>}
                    </section>
                    <section className="admin-panel">
                      <div className="admin-panel-heading"><div><h2>{en ? "Latest expenses" : "Dernières dépenses"}</h2><p>{en ? "Most recently recorded entries." : "Dernières dépenses saisies."}</p></div><button className="admin-inline-link" onClick={() => setTab("expenses")}>{en ? "View all" : "Tout voir"} <ChevronRight size={14} /></button></div>
                      {dashboard.recentExpenses.length ? dashboard.recentExpenses.map((expense) => (
                        <button className="admin-expense-recent" key={expense.id} onClick={() => openDetails(expense)}>
                          <span><strong>{expense.label}</strong><small>{expense.reference} · {categoryLabel(expense.category, locale)}</small></span>
                          <strong>{formatMoney(expense.amount, expense.currency, locale)}</strong>
                        </button>
                      )) : <p className="admin-expense-empty">{en ? "No expenses recorded yet." : "Aucune dépense enregistrée."}</p>}
                    </section>
                  </div>
                  <section className="admin-panel">
                    <div className="admin-panel-heading"><div><h2>{en ? "Largest recorded expenses" : "Dépenses les plus importantes"}</h2><p>{en ? "Actual invoice amounts, excluding security deposits and cancelled records." : "Montants réels des factures, hors dépôts de garantie et dépenses annulées."}</p></div></div>
                    {dashboard.topExpenses.length ? <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>{en ? "Reference" : "Référence"}</th><th>{en ? "Category" : "Catégorie"}</th><th>{en ? "Supplier" : "Fournisseur"}</th><th className="is-number">{en ? "Invoiced" : "Facturé"}</th></tr></thead><tbody>
                      {dashboard.topExpenses.map((expense) => <tr key={expense.id}><td>{expense.reference} · {expense.label}</td><td>{categoryLabel(expense.category, locale)}</td><td>{expense.beneficiary}</td><td className="is-number">{formatMoney(expense.amount, expense.currency, locale)}</td></tr>)}
                    </tbody></table></div> : <p className="admin-expense-empty">{en ? "No expenses recorded yet." : "Aucune dépense enregistrée."}</p>}
                  </section>
                  {dashboard.metrics.depositsPaidThisMonth > 0 && (
                    <p className="admin-expense-disclaimer"><Landmark size={15} /> {en ? "Security deposits paid this month, tracked separately from charges:" : "Dépôts de garantie versés ce mois, suivis séparément des charges :"}                     <strong>{formatMoney(dashboard.metrics.depositsPaidThisMonth, currency, locale)}</strong></p>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "expenses" && (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div><h2>{en ? "Expense register" : "Registre des dépenses"}</h2><p>{total} {en ? "entries · unpaid invoices do not count as cash outflows" : "entrées · les factures impayées ne sont pas des sorties de trésorerie"}</p></div>
                <button type="button" className="admin-primary-button is-compact" onClick={openCreate}><Plus size={15} /> {en ? "New expense" : "Nouvelle dépense"}</button>
              </div>
              <div className="admin-expense-filters">
                <label className="admin-expense-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={en ? "Reference, description, supplier…" : "Référence, libellé, fournisseur…"} /></label>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass()}>
                  <option value="">{en ? "All categories" : "Toutes les catégories"}</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, locale)}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass()}>
                  {statuses.map((status) => <option key={status} value={status}>{status === "ALL" ? (en ? "All statuses" : "Tous les statuts") : statusLabel(status, locale)}</option>)}
                </select>
                <select value={listCurrency} onChange={(event) => setListCurrency(event.target.value)} className={inputClass()}>
                  <option value="ALL">{en ? "All currencies" : "Toutes les devises"}</option><option value="XOF">XOF</option><option value="EUR">EUR</option><option value="USD">USD</option>
                </select>
              </div>
              <div className="admin-table-scroll"><table className="admin-data-table admin-expense-table"><thead><tr>
                <th>{en ? "Reference / label" : "Référence / libellé"}</th><th>{en ? "Category" : "Catégorie"}</th><th>{en ? "Date" : "Date"}</th><th>{en ? "Supplier" : "Fournisseur"}</th>
                <th className="is-number">{en ? "Invoiced" : "Facturé"}</th><th className="is-number">{en ? "Paid" : "Payé"}</th><th>{en ? "Status" : "Statut"}</th><th>{en ? "Actions" : "Actions"}</th>
              </tr></thead><tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td><button className="admin-expense-row-link" onClick={() => openDetails(expense)}><strong>{expense.reference}</strong><span>{expense.label}{expense.isDeposit ? ` · ${en ? "Deposit" : "Dépôt"}` : ""}</span></button></td>
                    <td>{categoryLabel(expense.category, locale)}</td><td>{formatDate(expense.expenseDate, locale)}</td><td>{expense.beneficiary}</td>
                    <td className="is-number">{formatMoney(expense.amount, expense.currency, locale)}</td><td className="is-number">{formatMoney(expense.paidAmount, expense.currency, locale)}</td>
                    <td><span className={statusClass(expense.status)}>{statusLabel(expense.status, locale)}</span>{expense.cancellationStatus === "REQUESTED" && <small className="admin-expense-pending">{en ? "Cancellation pending" : "Annulation en attente"}</small>}</td>
                    <td><div className="admin-row-actions"><button className="admin-icon-button" title={en ? "View details" : "Voir le détail"} onClick={() => openDetails(expense)}><FileText size={15} /></button>
                      <button className="admin-icon-button" title={en ? "Download summary" : "Télécharger le récapitulatif"} onClick={() => window.open(`/api/admin/depenses/${expense.id}/pdf`, "_blank", "noopener,noreferrer")}><ArrowDownToLine size={15} /></button>
                    </div></td>
                  </tr>
                ))}
                {!expenses.length && <tr><td colSpan={8} className="admin-expense-empty">{en ? "No expense matches these filters." : "Aucune dépense ne correspond à ces filtres."}</td></tr>}
              </tbody></table></div>
              <div className="admin-expense-pagination"><span>{en ? `Page ${page} of ${pageCount}` : `Page ${page} sur ${pageCount}`}</span><div>
                <button type="button" className="admin-icon-button" disabled={page <= 1} onClick={() => loadExpenseList(page - 1)} aria-label={en ? "Previous page" : "Page précédente"}><ChevronLeft size={16} /></button>
                <button type="button" className="admin-icon-button" disabled={page >= pageCount} onClick={() => loadExpenseList(page + 1)} aria-label={en ? "Next page" : "Page suivante"}><ChevronRight size={16} /></button>
              </div></div>
            </section>
          )}

          {tab === "schedules" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>{en ? "Recurring due dates" : "Échéances récurrentes"}</h2><p>{en ? "Forecasts never create expenses or payments automatically." : "Les prévisions ne créent jamais automatiquement de dépenses ou de paiements."}</p></div><button type="button" className="admin-primary-button is-compact" onClick={openNewSchedule}><Plus size={15} /> {en ? "Add due date" : "Ajouter une échéance"}</button></div>
              {schedules.length ? <div className="admin-expense-schedule-list">{schedules.map((schedule) => (
                <article className="admin-expense-schedule" key={schedule.id}>
                  <div className="admin-expense-schedule-main">
                    <span className="admin-expense-upcoming-icon is-schedule"><CalendarClock size={17} /></span>
                    <div><strong>{schedule.label}</strong><small>{categoryLabel(schedule.category, locale)} · {schedule.beneficiary} · {schedule.frequency === "CUSTOM" ? `${schedule.customFrequencyDays} ${en ? "days" : "jours"}` : schedule.frequency.toLowerCase()}</small>
                      <small>{en ? "Next due" : "Prochaine échéance"} : {formatDate(schedule.nextDueAt, locale)} · {schedule.reminderDays} {en ? "days notice" : "j avant alerte"}</small></div>
                  </div>
                  <div className="admin-expense-schedule-meta">{schedule.estimatedAmount ? formatMoney(schedule.estimatedAmount, schedule.currency, locale) : (en ? "Estimate not set" : "Montant estimatif absent")}<span className={schedule.isActive ? "is-active" : ""}>{schedule.isActive ? (en ? "Active" : "Active") : (en ? "Disabled" : "Désactivée")}</span></div>
                  <div className="admin-expense-schedule-actions">
                    {schedule.isActive && <button className="admin-primary-button is-compact" onClick={() => {
                      setOccurrenceSchedule(schedule);
                      setOccurrenceDraft({ amount: schedule.estimatedAmount ? String(schedule.estimatedAmount) : "", invoiceNumber: "", invoiceDate: "", periodStart: "", periodEnd: "", initialPaymentAmount: "", initialPaymentMethod: "CASH" });
                    }}>{en ? "Record expense" : "Enregistrer la dépense"}</button>}
                    <button className="admin-icon-button" title={en ? "Edit due date" : "Modifier l’échéance"} onClick={() => openEditSchedule(schedule)}><Pencil size={14} /></button>
                    <button className="admin-icon-button" title={schedule.isActive ? (en ? "Disable" : "Désactiver") : (en ? "Enable" : "Activer")} onClick={() => toggleSchedule(schedule)}><Settings2 size={15} /></button>
                  </div>
                </article>
              ))}</div> : <p className="admin-expense-empty">{en ? "No recurring due dates have been created." : "Aucune échéance récurrente n’a été créée."}</p>}
            </section>
          )}

          {tab === "reports" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>{en ? "Monthly expenses report" : "Rapport mensuel des dépenses"}</h2><p>{en ? "The report separates recorded expenses, invoices and payments made." : "Le rapport distingue les dépenses saisies, les factures et les paiements réalisés."}</p></div></div>
              {!canExport ? <p className="admin-expense-error">{en ? "Your account is not allowed to export financial reports." : "Ton compte n’est pas autorisé à exporter les rapports financiers."}</p> : (
                <>
                  <form className="admin-expense-filters admin-expense-report-filters" onSubmit={loadReport}>
                    <label>{en ? "Year" : "Année"}<input type="number" min="2000" max="2100" className={inputClass()} value={reportFilters.year} onChange={(event) => setReportFilters({ ...reportFilters, year: event.target.value })} required /></label>
                    <label>{en ? "Month" : "Mois"}<select className={inputClass()} value={reportFilters.month} onChange={(event) => setReportFilters({ ...reportFilters, month: event.target.value })}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat(en ? "en-US" : "fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, index, 1)))}</option>)}</select></label>
                    <label>{en ? "Currency" : "Devise"}<input className={inputClass()} value={reportFilters.currency} maxLength={3} pattern="[A-Z]{3}" required onChange={(event) => setReportFilters({ ...reportFilters, currency: event.target.value.toUpperCase() })} /></label>
                    <label>{en ? "Category" : "Catégorie"}<select className={inputClass()} value={reportFilters.categoryId} onChange={(event) => setReportFilters({ ...reportFilters, categoryId: event.target.value })}><option value="">{en ? "All" : "Toutes"}</option>{categories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, locale)}</option>)}</select></label>
                    <label>{en ? "Status" : "Statut"}<select className={inputClass()} value={reportFilters.status} onChange={(event) => setReportFilters({ ...reportFilters, status: event.target.value })}>{statuses.filter((status) => status !== "OPEN").map((status) => <option key={status} value={status}>{status === "ALL" ? (en ? "All" : "Tous") : statusLabel(status, locale)}</option>)}</select></label>
                    <label>{en ? "Payment method" : "Mode de paiement"}<select className={inputClass()} value={reportFilters.method} onChange={(event) => setReportFilters({ ...reportFilters, method: event.target.value })}><option value="">{en ? "All" : "Tous"}</option>{paymentMethodsOptions}</select></label>
                    <label>{en ? "Supplier / beneficiary" : "Fournisseur / bénéficiaire"}<input className={inputClass()} value={reportFilters.beneficiary} onChange={(event) => setReportFilters({ ...reportFilters, beneficiary: event.target.value })} /></label>
                    <button type="submit" className="admin-primary-button"><BarChart3 size={15} /> {en ? "Generate report" : "Générer le rapport"}</button>
                  </form>
                  {report && <>
                    <div className="admin-expense-report-summary">
                      <div><span>{en ? "Recorded in month" : "Saisies du mois"}</span><strong>{report.recordedCount}</strong></div>
                      <div><span>{en ? "Invoices for month" : "Factures de la période"}</span><strong>{formatMoney(report.totalInvoiced, report.currency, locale)}</strong></div>
                      <div><span>{en ? "Paid during month" : "Payé pendant le mois"}</span><strong>{formatMoney(report.totalPaidThisMonth, report.currency, locale)}</strong></div>
                      <div><span>{en ? "Remaining" : "Reste à payer"}</span><strong>{formatMoney(report.outstanding, report.currency, locale)}</strong></div>
                      <div><span>{en ? "Overdue" : "En retard"}</span><strong>{formatMoney(report.overdue, report.currency, locale)}</strong></div>
                    </div>
                    <div className="admin-expense-report-toolbar"><span>{report.expenses.length} {en ? "invoice(s) in the selected period" : "facture(s) pour la période filtrée"}</span><a className="admin-primary-button is-compact" href={reportUrl} target="_blank" rel="noreferrer"><ArrowDownToLine size={15} /> {en ? "Print / save PDF" : "Imprimer / enregistrer PDF"}</a></div>
                    <div className="admin-table-scroll"><table className="admin-data-table admin-expense-table"><thead><tr><th>{en ? "Reference" : "Référence"}</th><th>{en ? "Date" : "Date"}</th><th>{en ? "Category" : "Catégorie"}</th><th>{en ? "Description" : "Désignation"}</th><th>{en ? "Beneficiary" : "Bénéficiaire"}</th><th className="is-number">{en ? "Invoiced" : "Facturé"}</th><th className="is-number">{en ? "Paid" : "Payé"}</th><th className="is-number">{en ? "Balance" : "Solde"}</th><th>{en ? "Status" : "Statut"}</th></tr></thead><tbody>
                      {report.expenses.map((expense) => <tr key={expense.id}><td>{expense.reference}</td><td>{formatDate(expense.expenseDate, locale)}</td><td>{expense.categoryName}</td><td>{expense.label}</td><td>{expense.beneficiary}</td><td className="is-number">{formatMoney(expense.amount, expense.currency, locale)}</td><td className="is-number">{formatMoney(expense.paidAmount, expense.currency, locale)}</td><td className="is-number">{formatMoney(expense.remainingAmount, expense.currency, locale)}</td><td><span className={statusClass(expense.computedStatus)}>{statusLabel(expense.computedStatus, locale)}</span></td></tr>)}
                      {!report.expenses.length && <tr><td colSpan={9} className="admin-expense-empty">{en ? "No data for these filters." : "Aucune donnée pour ces filtres."}</td></tr>}
                    </tbody></table></div>
                    <p className="admin-expense-disclaimer"><AlertTriangle size={15} /> {en ? "Application-generated summary, not an official invoice or certified payment proof." : "Récapitulatif généré par l’application ; ce n’est ni une facture officielle ni une preuve de paiement certifiée."}</p>
                  </>}
                </>
              )}
            </section>
          )}

          {tab === "categories" && manager && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>{en ? "Expense categories" : "Catégories de dépenses"}</h2><p>{en ? "Categories already used remain linked to their expenses." : "Les catégories déjà utilisées restent liées à leurs dépenses."}</p></div><button type="button" className="admin-primary-button is-compact" onClick={() => setCategoryOpen(true)}><Plus size={15} /> {en ? "Add category" : "Ajouter une catégorie"}</button></div>
              <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>{en ? "Identifier" : "Identifiant"}</th><th>{en ? "French name" : "Nom français"}</th><th>{en ? "English name" : "Nom anglais"}</th><th>{en ? "Type" : "Type"}</th><th>{en ? "Status" : "Statut"}</th><th>{en ? "Actions" : "Actions"}</th></tr></thead><tbody>
                {categories.map((category) => <tr key={category.id}><td>{category.slug}</td><td>{category.nameFr}</td><td>{category.nameEn}</td><td>{category.isBuiltin ? (en ? "Built-in" : "Prédéfinie") : (en ? "Custom" : "Personnalisée")}</td><td>{category.isActive === false ? (en ? "Disabled" : "Désactivée") : (en ? "Active" : "Active")}</td><td><div className="admin-row-actions"><button className="admin-icon-button" aria-label={en ? "Edit category" : "Modifier la catégorie"} onClick={() => { setCategoryEditingId(category.id); setCategoryDraft({ slug: category.slug, nameFr: category.nameFr, nameEn: category.nameEn, sortOrder: String(category.sortOrder ?? 0) }); setCategoryOpen(true); }}><Pencil size={14} /></button><button className="admin-icon-button" onClick={() => toggleCategory(category)}>{category.isActive === false ? (en ? "Enable" : "Activer") : (en ? "Disable" : "Désactiver")}</button></div></td></tr>)}
              </tbody></table></div>
            </section>
          )}
        </>
      )}

      {formOpen && (
        <div className="admin-expense-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="admin-expense-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
            <header><div><span className="admin-eyebrow">{en ? "EXPENSE ENTRY" : "SAISIE DE DÉPENSE"}</span><h2 id="expense-form-title">{editingId ? (en ? "Edit expense" : "Modifier la dépense") : (en ? "New expense" : "Nouvelle dépense")}</h2></div><button className="admin-icon-button" onClick={() => setFormOpen(false)} aria-label={en ? "Close" : "Fermer"}><X size={18} /></button></header>
            <form onSubmit={onSaveExpense}>
              <div className="admin-expense-form-scroll">
                <div className="admin-form-grid">
                  <label>{en ? "Category" : "Catégorie"}<select className={inputClass()} required value={form.categoryId} onChange={(event) => {
                    const category = categoryById.get(event.target.value);
                    setForm((current) => ({ ...current, categoryId: event.target.value, details: categoryDetailsDefaults(category?.slug ?? "") }));
                  }}><option value="">{en ? "Choose a category" : "Choisir une catégorie"}</option>{categories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, locale)}</option>)}</select></label>
                  <label>{en ? "Label" : "Libellé"}<input className={inputClass()} required minLength={2} maxLength={180} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></label>
                  <label>{en ? "Supplier / beneficiary" : "Fournisseur / bénéficiaire"}<input className={inputClass()} required minLength={2} maxLength={180} value={form.beneficiary} onChange={(event) => setForm({ ...form, beneficiary: event.target.value })} /></label>
                  <label className="admin-form-full">{en ? "Description / reason" : "Description / motif"}<textarea required minLength={2} maxLength={4000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                  <label>{en ? "Amount" : "Montant"}<input className={inputClass()} type="number" min="1" step="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
                  <label>{en ? "Currency" : "Devise"}<input className={inputClass()} value={form.currency} maxLength={3} pattern="[A-Z]{3}" required onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></label>
                  <label>{en ? "Expense date" : "Date de dépense"}<input className={inputClass()} type="date" required value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></label>
                  <label>{en ? "Payment due date" : "Date d’échéance"}<input className={inputClass()} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
                  <label>{en ? "Invoice date" : "Date d’émission"}<input className={inputClass()} type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} /></label>
                  <label>{en ? "Invoice / receipt number" : "Numéro de facture / reçu"}<input className={inputClass()} maxLength={120} value={form.invoiceNumber} onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })} /></label>
                  <label>{en ? "Period start" : "Début de période"}<input className={inputClass()} type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} /></label>
                  <label>{en ? "Period end" : "Fin de période"}<input className={inputClass()} type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} /></label>

                  {currentDetailSlug === "electricity" && <>
                    <label>{en ? "Billing type" : "Type de facturation"}<select className={inputClass()} value={String(form.details.type ?? "POSTPAID")} onChange={(event) => setDetail("type", event.target.value)}><option value="PREPAID">{en ? "Prepaid" : "Prépayée"}</option><option value="POSTPAID">{en ? "Postpaid" : "Postpayée"}</option></select></label>
                    <label>{en ? "Provider" : "Fournisseur"}<input className={inputClass()} value={String(form.details.provider ?? "SBEE")} onChange={(event) => setDetail("provider", event.target.value)} required /></label>
                    <label>{en ? "Meter number (optional)" : "Numéro du compteur (facultatif)"}<input className={inputClass()} value={String(form.details.meterNumber ?? "")} onChange={(event) => setDetail("meterNumber", event.target.value)} /></label>
                    {form.details.type === "PREPAID" && <label>{en ? "Purchased kWh" : "kWh achetés"}<input className={inputClass()} type="number" min="0.01" step="0.01" required value={String(form.details.kilowattHours ?? "")} onChange={(event) => setDetail("kilowattHours", Number(event.target.value))} /></label>}
                    <label className="admin-form-full">{en ? "Observation" : "Observation"}<textarea value={String(form.details.observation ?? "")} onChange={(event) => setDetail("observation", event.target.value)} /></label>
                  </>}
                  {currentDetailSlug === "rent" && <>
                    <h3 className="admin-expense-section-title admin-form-full">{en ? "Rental information" : "Informations sur le loyer"}</h3>
                    <label>{en ? "Landlord full name" : "Nom complet du propriétaire"}<input className={inputClass()} required value={String(form.details.ownerName ?? "")} onChange={(event) => setDetail("ownerName", event.target.value)} /></label>
                    <label>{en ? "Landlord phone (optional)" : "Téléphone du propriétaire (facultatif)"}<input className={inputClass()} value={String(form.details.ownerPhone ?? "")} onChange={(event) => setDetail("ownerPhone", event.target.value)} /></label>
                    <label className="admin-form-full">{en ? "Rented premises address" : "Adresse du local loué"}<input className={inputClass()} required value={String(form.details.propertyAddress ?? "")} onChange={(event) => setDetail("propertyAddress", event.target.value)} /></label>
                    <label>{en ? "Frequency" : "Fréquence"}<select className={inputClass()} value={String(form.details.frequency ?? "MONTHLY")} onChange={(event) => setDetail("frequency", event.target.value)}>{["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "OTHER"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label>{en ? "Payment type" : "Type de paiement"}<select className={inputClass()} value={String(form.details.paymentType ?? "FULL")} onChange={(event) => setDetail("paymentType", event.target.value)}>{[["ADVANCE", en ? "Advance" : "Avance"], ["PARTIAL", en ? "Partial" : "Partiel"], ["FULL", en ? "Full payment" : "Paiement complet"], ["DEPOSIT", en ? "Security deposit" : "Dépôt de garantie"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="admin-form-full">{en ? "Observations" : "Observations"}<textarea value={String(form.details.observation ?? "")} onChange={(event) => setDetail("observation", event.target.value)} /></label>
                  </>}
                  {currentDetailSlug === "water" && <>
                    <label>{en ? "Provider" : "Fournisseur"}<input className={inputClass()} value={String(form.details.provider ?? "SONEB")} onChange={(event) => setDetail("provider", event.target.value)} required /></label>
                    <label>{en ? "Meter number" : "Numéro de compteur"}<input className={inputClass()} value={String(form.details.meterNumber ?? "")} onChange={(event) => setDetail("meterNumber", event.target.value)} /></label>
                    <label className="admin-form-full">{en ? "Observation" : "Observation"}<textarea value={String(form.details.observation ?? "")} onChange={(event) => setDetail("observation", event.target.value)} /></label>
                  </>}
                  {!editingId && <>
                    <h3 className="admin-expense-section-title admin-form-full">{en ? "Optional initial payment" : "Paiement initial facultatif"}</h3>
                    <label>{en ? "Amount already paid" : "Montant déjà payé"}<input className={inputClass()} type="number" min="1" step="1" value={form.initialPaymentAmount} onChange={(event) => setForm({ ...form, initialPaymentAmount: event.target.value })} /><small>{en ? "Leave empty for an unpaid bill. Payments are tracked independently." : "Laisse vide pour une facture impayée. Les paiements sont enregistrés séparément."}</small></label>
                    <label>{en ? "Payment method" : "Mode de paiement"}<select className={inputClass()} value={form.initialPaymentMethod} onChange={(event) => setForm({ ...form, initialPaymentMethod: event.target.value as ExpensePaymentMethod })}>{paymentMethodsOptions}</select></label>
                    <label>{en ? "Payment date" : "Date de paiement"}<input className={inputClass()} type="date" value={form.initialPaymentDate} onChange={(event) => setForm({ ...form, initialPaymentDate: event.target.value })} /></label>
                  </>}
                  <label className="admin-form-full">{en ? "Internal comment" : "Commentaire interne"}<textarea value={form.internalComment} onChange={(event) => setForm({ ...form, internalComment: event.target.value })} /></label>
                </div>
              </div>
              <footer className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={() => setFormOpen(false)}>{en ? "Cancel" : "Annuler"}</button><button className="admin-primary-button" disabled={saving}>{saving ? <LoaderCircle size={15} className="is-spinning" /> : <Check size={15} />}{en ? "Save expense" : "Enregistrer la dépense"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="admin-expense-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="admin-expense-dialog admin-expense-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title">
            <header><div><span className="admin-eyebrow">{selected.reference}</span><h2 id="expense-detail-title">{selected.label}</h2></div><button className="admin-icon-button" onClick={() => setSelected(null)} aria-label={en ? "Close" : "Fermer"}><X size={18} /></button></header>
            <div className="admin-expense-form-scroll">
              <div className="admin-expense-detail-grid">
                <div><small>{en ? "Category" : "Catégorie"}</small><strong>{categoryLabel(selected.category, locale)}</strong></div>
                <div><small>{en ? "Status" : "Statut"}</small><span className={statusClass(selected.status)}>{statusLabel(selected.status, locale)}</span></div>
                <div><small>{en ? "Invoice amount" : "Montant facturé"}</small><strong>{formatMoney(selected.amount, selected.currency, locale)}</strong></div>
                <div><small>{en ? "Paid / remaining" : "Payé / reste"}</small><strong>{formatMoney(selected.paidAmount, selected.currency, locale)} / {formatMoney(selected.remainingAmount, selected.currency, locale)}</strong></div>
                <div><small>{en ? "Supplier" : "Fournisseur"}</small><strong>{selected.beneficiary}</strong></div>
                <div><small>{en ? "Expense date / due date" : "Dépense / échéance"}</small><strong>{formatDate(selected.expenseDate, locale)} / {formatDate(selected.dueDate, locale)}</strong></div>
                <div className="is-full"><small>{en ? "Reason" : "Motif"}</small><p>{selected.description}</p></div>
                {selected.cancellationStatus === "REQUESTED" && <div className="is-full admin-expense-warning"><AlertTriangle size={15} /> {en ? "Cancellation request pending approval." : "Demande d’annulation en attente d’approbation."} {selected.cancellationReason}</div>}
              </div>
              <div className="admin-expense-detail-actions">
                <button type="button" className="admin-primary-button is-compact" onClick={() => { setSelected(null); openEdit(selected); }}><Pencil size={14} /> {en ? "Edit" : "Modifier"}</button>
                <button type="button" className="admin-secondary-button is-compact" onClick={() => window.open(`/api/admin/depenses/${selected.id}/pdf`, "_blank", "noopener,noreferrer")}><ArrowDownToLine size={14} /> {en ? "PDF summary" : "Récapitulatif PDF"}</button>
                {selected.status !== "CANCELLED" && selected.cancellationStatus !== "REQUESTED" && <button type="button" className="admin-secondary-button is-compact is-danger" onClick={() => {
                  const reason = window.prompt(en ? "Why should this expense be cancelled?" : "Motif de l’annulation");
                  if (reason?.trim()) { setCancelReason(reason.trim()); void submitCancellation("REQUEST", reason.trim()); }
                }}>{en ? "Request cancellation" : "Demander l’annulation"}</button>}
                {canApprove && selected.cancellationStatus === "REQUESTED" && <>
                  <button type="button" className="admin-primary-button is-compact" onClick={() => {
                    const reason = window.prompt(en ? "Approval reason" : "Motif d’approbation", selected.cancellationReason ?? "");
                    if (reason?.trim()) { setCancelReason(reason.trim()); void submitCancellation("APPROVE", reason.trim()); }
                  }}>{en ? "Approve cancellation" : "Approuver l’annulation"}</button>
                  <button type="button" className="admin-secondary-button is-compact" onClick={() => {
                    const reason = window.prompt(en ? "Reason for refusal" : "Motif du refus");
                    if (reason?.trim()) { setCancelReason(reason.trim()); void submitCancellation("REJECT", reason.trim()); }
                  }}>{en ? "Reject" : "Refuser"}</button>
                </>}
                {selected.status !== "PAID" && selected.status !== "CANCELLED" && <button type="button" className="admin-primary-button is-compact" onClick={() => setPaymentOpen(true)}><CircleDollarSign size={14} /> {en ? "Add payment" : "Ajouter un paiement"}</button>}
              </div>
              <h3 className="admin-expense-section-title">{en ? "Split payments" : "Paiements fractionnés"}</h3>
              {(selected.payments ?? []).length ? <div className="admin-expense-payment-list">{selected.payments?.map((payment) => (
                <div className={`admin-expense-payment${payment.isVoided ? " is-voided" : ""}`} key={payment.id}>
                  <span><strong>{formatMoney(payment.amount, selected.currency, locale)}</strong><small>{formatDate(payment.paidAt, locale)} · {methodLabel(payment.method, locale)} · {payment.createdBy.fullName}</small>{payment.isVoided && <small>{payment.voidReason}</small>}</span>
                  {canApprove && !payment.isVoided && <button type="button" className="admin-secondary-button is-compact is-danger" onClick={() => voidPayment(payment)}>{en ? "Correct" : "Corriger"}</button>}
                </div>
              ))}</div> : <p className="admin-expense-empty">{en ? "No payment recorded." : "Aucun paiement enregistré."}</p>}
              <h3 className="admin-expense-section-title">{en ? "Supporting documents" : "Justificatifs"}</h3>
              <div className="admin-expense-attachments">
                {(selected.attachments ?? []).map((attachment) => <a key={attachment.id} href={`/api/admin/depenses/${selected.id}/pieces-jointes/${attachment.id}`} target="_blank" rel="noreferrer"><Paperclip size={14} /> {attachment.fileName}</a>)}
                <label className="admin-secondary-button is-compact"><Paperclip size={14} /> {attachmentBusy ? (en ? "Uploading…" : "Téléversement…") : (en ? "Add a file" : "Ajouter un fichier")}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={attachmentBusy} onChange={(event) => { void uploadAttachment(event.target.files?.[0]); event.target.value = ""; }} /></label>
              </div>
              <h3 className="admin-expense-section-title">{en ? "Financial audit history" : "Historique d’audit financier"}</h3>
              {selected.auditEvents?.map((event) => <div className="admin-expense-audit" key={event.id}><strong>{event.action}</strong><span>{event.actor.fullName} · {formatDate(event.occurredAt, locale)} · {event.result}</span>{event.reason && <small>{event.reason}</small>}</div>)}
            </div>
          </section>
        </div>
      )}

      {paymentOpen && selected && (
        <div className="admin-expense-overlay admin-expense-overlay-front">
          <section className="admin-expense-dialog admin-expense-small-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            <header><h2 id="payment-title">{en ? "Record a payment" : "Enregistrer un paiement"}</h2><button className="admin-icon-button" onClick={() => setPaymentOpen(false)} aria-label={en ? "Close" : "Fermer"}><X size={18} /></button></header>
            <p>{en ? "Remaining balance" : "Solde restant"} : <strong>{formatMoney(selected.remainingAmount, selected.currency, locale)}</strong></p>
            <form onSubmit={submitPayment}><div className="admin-form-grid">
              <label>{en ? "Amount paid" : "Montant payé"}<input className={inputClass()} type="number" min="1" max={selected.remainingAmount} step="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></label>
              <label>{en ? "Payment method" : "Mode de paiement"}<select className={inputClass()} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as ExpensePaymentMethod)}>{paymentMethodsOptions}</select></label>
              <label>{en ? "Payment date" : "Date du paiement"}<input className={inputClass()} type="date" value={paymentDate} max={localDate()} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
              <label>{en ? "Comment" : "Commentaire"}<input className={inputClass()} value={paymentComment} onChange={(event) => setPaymentComment(event.target.value)} /></label>
            </div><footer className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={() => setPaymentOpen(false)}>{en ? "Cancel" : "Annuler"}</button><button className="admin-primary-button" disabled={saving}>{en ? "Record payment" : "Enregistrer le paiement"}</button></footer></form>
          </section>
        </div>
      )}

      {categoryOpen && (
        <div className="admin-expense-overlay">
          <section className="admin-expense-dialog admin-expense-small-dialog" role="dialog" aria-modal="true" aria-labelledby="category-title">
            <header><h2 id="category-title">{categoryEditingId ? (en ? "Edit expense category" : "Modifier la catégorie") : (en ? "Add expense category" : "Ajouter une catégorie de dépense")}</h2><button className="admin-icon-button" onClick={() => setCategoryOpen(false)} aria-label={en ? "Close" : "Fermer"}><X size={18} /></button></header>
            <form onSubmit={createCategory}><div className="admin-form-grid">
              <label>{en ? "Identifier" : "Identifiant"}<input className={inputClass()} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={60} readOnly={Boolean(categoryEditingId)} value={categoryDraft.slug} onChange={(event) => setCategoryDraft({ ...categoryDraft, slug: event.target.value.toLowerCase() })} /></label>
              <label>{en ? "Sort order" : "Ordre"}<input className={inputClass()} type="number" min="0" max="10000" value={categoryDraft.sortOrder} onChange={(event) => setCategoryDraft({ ...categoryDraft, sortOrder: event.target.value })} /></label>
              <label>{en ? "French name" : "Nom français"}<input className={inputClass()} required value={categoryDraft.nameFr} onChange={(event) => setCategoryDraft({ ...categoryDraft, nameFr: event.target.value })} /></label>
              <label>{en ? "English name" : "Nom anglais"}<input className={inputClass()} required value={categoryDraft.nameEn} onChange={(event) => setCategoryDraft({ ...categoryDraft, nameEn: event.target.value })} /></label>
            </div><footer className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={() => { setCategoryOpen(false); setCategoryEditingId(null); }}>{en ? "Cancel" : "Annuler"}</button><button className="admin-primary-button" disabled={saving}>{categoryEditingId ? (en ? "Save changes" : "Enregistrer") : (en ? "Create" : "Créer")}</button></footer></form>
          </section>
        </div>
      )}

      {scheduleOpen && (
        <div className="admin-expense-overlay">
          <section className="admin-expense-dialog admin-expense-small-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
            <header><div><span className="admin-eyebrow">{en ? "FORECAST ONLY" : "PRÉVISION UNIQUEMENT"}</span><h2 id="schedule-title">{scheduleEditingId ? (en ? "Edit recurring due date" : "Modifier l’échéance récurrente") : (en ? "New recurring due date" : "Nouvelle échéance récurrente")}</h2></div><button className="admin-icon-button" onClick={() => setScheduleOpen(false)} aria-label={en ? "Close" : "Fermer"}><X size={18} /></button></header>
            <form onSubmit={saveSchedule}><div className="admin-expense-form-scroll"><div className="admin-form-grid">
              <label>{en ? "Category" : "Catégorie"}<select className={inputClass()} required value={scheduleDraft.categoryId} onChange={(event) => { const category = categoryById.get(event.target.value); setScheduleDraft({ ...scheduleDraft, categoryId: event.target.value, details: categoryDetailsDefaults(category?.slug ?? "") }); }}><option value="">{en ? "Choose" : "Choisir"}</option>{categories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, locale)}</option>)}</select></label>
              <label>{en ? "Label" : "Libellé"}<input className={inputClass()} required value={scheduleDraft.label} onChange={(event) => setScheduleDraft({ ...scheduleDraft, label: event.target.value })} /></label>
              <label>{en ? "Supplier / beneficiary" : "Fournisseur / bénéficiaire"}<input className={inputClass()} required value={scheduleDraft.beneficiary} onChange={(event) => setScheduleDraft({ ...scheduleDraft, beneficiary: event.target.value })} /></label>
              <label>{en ? "Frequency" : "Fréquence"}<select className={inputClass()} value={scheduleDraft.frequency} onChange={(event) => setScheduleDraft({ ...scheduleDraft, frequency: event.target.value })}>{frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}</select></label>
              {scheduleDraft.frequency === "CUSTOM" && <label>{en ? "Number of days" : "Nombre de jours"}<input className={inputClass()} type="number" min="1" max="3650" required value={scheduleDraft.customFrequencyDays} onChange={(event) => setScheduleDraft({ ...scheduleDraft, customFrequencyDays: event.target.value })} /></label>}
              <label>{en ? "Next due date" : "Prochaine échéance"}<input className={inputClass()} type="date" required value={scheduleDraft.nextDueAt} onChange={(event) => setScheduleDraft({ ...scheduleDraft, nextDueAt: event.target.value })} /></label>
              <label>{en ? "Estimated amount (optional)" : "Montant estimatif (facultatif)"}<input className={inputClass()} type="number" min="1" step="1" value={scheduleDraft.estimatedAmount} onChange={(event) => setScheduleDraft({ ...scheduleDraft, estimatedAmount: event.target.value })} /></label>
              <label>{en ? "Currency" : "Devise"}<input className={inputClass()} value={scheduleDraft.currency} maxLength={3} onChange={(event) => setScheduleDraft({ ...scheduleDraft, currency: event.target.value.toUpperCase() })} /></label>
              <label>{en ? "Reminder days before due" : "Alerte avant échéance (jours)"}<input className={inputClass()} type="number" min="0" max="365" value={scheduleDraft.reminderDays} onChange={(event) => setScheduleDraft({ ...scheduleDraft, reminderDays: event.target.value })} /></label>
              {scheduleEditingId && <label className="admin-checkbox-row"><input type="checkbox" checked={scheduleActive} onChange={(event) => setScheduleActive(event.target.checked)} />{en ? "Active" : "Active"}</label>}
              {scheduleCategory?.slug === "electricity" && <>
                <label>{en ? "Billing type" : "Type"}<select className={inputClass()} value={String(scheduleDraft.details.type ?? "POSTPAID")} onChange={(event) => setScheduleDraft({ ...scheduleDraft, details: { ...scheduleDraft.details, type: event.target.value } })}><option value="POSTPAID">{en ? "Postpaid" : "Postpayée"}</option><option value="PREPAID">{en ? "Prepaid" : "Prépayée"}</option></select></label>
                <label>{en ? "Provider" : "Fournisseur"}<input className={inputClass()} value={String(scheduleDraft.details.provider ?? "SBEE")} onChange={(event) => setScheduleDraft({ ...scheduleDraft, details: { ...scheduleDraft.details, provider: event.target.value } })} /></label>
                {scheduleDraft.details.type === "PREPAID" && <label>{en ? "Expected kWh" : "kWh prévus"}<input className={inputClass()} type="number" min="0.01" step="0.01" required value={String(scheduleDraft.details.kilowattHours ?? "")} onChange={(event) => setScheduleDraft({ ...scheduleDraft, details: { ...scheduleDraft.details, kilowattHours: Number(event.target.value) } })} /></label>}
              </>}
              {scheduleCategory?.slug === "water" && <label>{en ? "Provider" : "Fournisseur"}<input className={inputClass()} value={String(scheduleDraft.details.provider ?? "SONEB")} onChange={(event) => setScheduleDraft({ ...scheduleDraft, details: { ...scheduleDraft.details, provider: event.target.value } })} /></label>}
              {scheduleCategory?.slug === "rent" && <>
                <label>{en ? "Landlord name" : "Nom du propriétaire"}<input className={inputClass()} required value={String(scheduleDraft.details.ownerName ?? "")} onChange={(event) => setScheduleDraft({ ...scheduleDraft, details: { ...scheduleDraft.details, ownerName: event.target.value } })} /></label>
                <label>{en ? "Rented premises address" : "Adresse du local"}<input className={inputClass()} required value={String(scheduleDraft.details.propertyAddress ?? "")} onChange={(event) => setScheduleDraft({ ...scheduleDraft, details: { ...scheduleDraft.details, propertyAddress: event.target.value } })} /></label>
              </>}
            </div></div><footer className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={() => setScheduleOpen(false)}>{en ? "Cancel" : "Annuler"}</button><button className="admin-primary-button" disabled={saving}>{scheduleEditingId ? (en ? "Save changes" : "Enregistrer") : (en ? "Save forecast" : "Enregistrer la prévision")}</button></footer></form>
          </section>
        </div>
      )}

      {occurrenceSchedule && (
        <div className="admin-expense-overlay">
          <section className="admin-expense-dialog admin-expense-small-dialog" role="dialog" aria-modal="true" aria-labelledby="occurrence-title">
            <header><div><span className="admin-eyebrow">{en ? "EXPLICIT ENTRY" : "SAISIE EXPLICITE"}</span><h2 id="occurrence-title">{en ? "Record actual expense" : "Enregistrer la dépense réelle"}</h2><p>{occurrenceSchedule.label} · {formatDate(occurrenceSchedule.nextDueAt, locale)}</p></div><button className="admin-icon-button" onClick={() => setOccurrenceSchedule(null)} aria-label={en ? "Close" : "Fermer"}><X size={18} /></button></header>
            <form onSubmit={recordOccurrence}><div className="admin-expense-form-scroll"><div className="admin-form-grid">
              <label>{en ? "Actual amount" : "Montant réel"}<input className={inputClass()} type="number" min="1" step="1" required value={occurrenceDraft.amount} onChange={(event) => setOccurrenceDraft({ ...occurrenceDraft, amount: event.target.value })} /></label>
              <label>{en ? "Invoice number" : "Numéro de facture"}<input className={inputClass()} value={occurrenceDraft.invoiceNumber} onChange={(event) => setOccurrenceDraft({ ...occurrenceDraft, invoiceNumber: event.target.value })} /></label>
              <label>{en ? "Invoice date" : "Date d’émission"}<input className={inputClass()} type="date" value={occurrenceDraft.invoiceDate} onChange={(event) => setOccurrenceDraft({ ...occurrenceDraft, invoiceDate: event.target.value })} /></label>
              <label>{en ? "Period start" : "Début de période"}<input className={inputClass()} type="date" value={occurrenceDraft.periodStart} onChange={(event) => setOccurrenceDraft({ ...occurrenceDraft, periodStart: event.target.value })} /></label>
              <label>{en ? "Period end" : "Fin de période"}<input className={inputClass()} type="date" value={occurrenceDraft.periodEnd} onChange={(event) => setOccurrenceDraft({ ...occurrenceDraft, periodEnd: event.target.value })} /></label>
              {occurrenceSchedule.category.slug === "electricity" && occurrenceSchedule.details?.type === "POSTPAID" && <div className="admin-expense-warning admin-form-full"><AlertTriangle size={14} />{en ? "Postpaid electricity requires an invoice number, issue date, and billing period." : "L’électricité postpayée exige le numéro, la date d’émission et la période facturée."}</div>}
              <label>{en ? "Initial payment (optional)" : "Paiement initial (facultatif)"}<input className={inputClass()} type="number" min="1" step="1" value={occurrenceDraft.initialPaymentAmount} onChange={(event) => setOccurrenceDraft({ ...occurrenceDraft, initialPaymentAmount: event.target.value })} /></label>
              <label>{en ? "Payment method" : "Mode de paiement"}<select className={inputClass()} value={occurrenceDraft.initialPaymentMethod} onChange={(event) => setOccurrenceDraft({ ...occurrenceDraft, initialPaymentMethod: event.target.value as ExpensePaymentMethod })}>{paymentMethodsOptions}</select></label>
            </div></div><footer className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={() => setOccurrenceSchedule(null)}>{en ? "Cancel" : "Annuler"}</button><button className="admin-primary-button" disabled={saving}>{en ? "Record expense" : "Enregistrer la dépense"}</button></footer></form>
          </section>
        </div>
      )}
    </div>
  );
}
