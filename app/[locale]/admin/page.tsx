import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Banknote, BookOpenText, Boxes, BriefcaseBusiness, FolderTree, Lightbulb, Package, Plus, ReceiptText } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import AdminGreeting from "@/components/admin/AdminGreeting";
import DashboardRevenueChart from "@/components/admin/DashboardRevenueChart";

export const instant = false;

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaffSession();
  if (staff?.role === "CASHIER") redirect(`/${locale}/admin/caisse`);
  if (staff?.role === "MANAGER") redirect(`/${locale}/admin/stock`);
  const en = locale === "en";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const revenueDays = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(today);
    start.setDate(today.getDate() - (6 - index));
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return {
      start,
      end,
      label: new Intl.DateTimeFormat(en ? "en-US" : "fr-FR", { weekday: "short" }).format(start),
    };
  });

  const [products, categories, services, solutions, articles, quotes, orders, stockItems, registers, recentQuotes, recentOrders, revenueByDay] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.service.count(),
    prisma.businessSolution.count(),
    prisma.article.count(),
    prisma.quoteRequest.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
    prisma.customerOrder.count(),
    prisma.stockItem.count({ where: { isActive: true } }),
    prisma.cashRegister.count({ where: { isActive: true } }),
    prisma.quoteRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, reference: true, fullName: true, service: true, status: true, createdAt: true },
    }),
    prisma.customerOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, orderNumber: true, customerName: true, totalAmount: true, status: true, createdAt: true },
    }),
    Promise.all(revenueDays.map(async ({ start, end, label }) => {
      const result = await prisma.orderPayment.aggregate({
        where: { createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
      });
      return { label, amount: result._sum.amount ?? 0 };
    })),
  ]);

  const stats = [
    { label: en ? "Received today" : "Encaissé aujourd’hui", value: revenueByDay[6].amount, displayValue: true, icon: Banknote, href: `/${locale}/admin/caisse`, tone: "green" },
    { label: en ? "Products" : "Produits", value: products, icon: Package, href: `/${locale}/admin/produits`, tone: "blue" },
    { label: en ? "Categories" : "Catégories", value: categories, icon: FolderTree, href: `/${locale}/admin/categories`, tone: "orange" },
    { label: en ? "Services" : "Services", value: services, icon: BriefcaseBusiness, href: `/${locale}/admin/services`, tone: "violet" },
    { label: en ? "Business solutions" : "Solutions entreprises", value: solutions, icon: Lightbulb, href: `/${locale}/admin/solutions-entreprises`, tone: "orange" },
    { label: en ? "Advice articles" : "Conseils", value: articles, icon: BookOpenText, href: `/${locale}/admin/conseils`, tone: "blue" },
    { label: en ? "Orders & invoices" : "Commandes & factures", value: orders, icon: ReceiptText, href: `/${locale}/admin/commandes`, tone: "green" },
    { label: en ? "Inventory items" : "Fiches matières", value: stockItems, icon: Boxes, href: `/${locale}/admin/stock`, tone: "violet" },
    { label: en ? "Cash registers" : "Caisses", value: registers, icon: Banknote, href: `/${locale}/admin/caisse`, tone: "orange" },
    { label: en ? "Requests to follow up" : "Devis à suivre", value: quotes, icon: ReceiptText, href: `/${locale}/admin/devis`, tone: "green" },
  ];

  const shortcuts = [
    { label: en ? "Add a service" : "Ajouter un service", href: `/${locale}/admin/services`, icon: BriefcaseBusiness },
    { label: en ? "Manage business solutions" : "Gérer les solutions entreprises", href: `/${locale}/admin/solutions-entreprises`, icon: Lightbulb },
    { label: en ? "Manage advice articles" : "Gérer les conseils", href: `/${locale}/admin/conseils`, icon: BookOpenText },
    { label: en ? "Manage categories" : "Gérer les catégories", href: `/${locale}/admin/categories`, icon: FolderTree },
    { label: en ? "Review quote requests" : "Voir les demandes de devis", href: `/${locale}/admin/devis`, icon: ReceiptText },
  ];
  const quoteStatuses: Record<string, string> = {
    NEW: en ? "New" : "Nouveau",
    IN_PROGRESS: en ? "In progress" : "En cours",
    QUOTED: en ? "Quoted" : "Chiffré",
    ACCEPTED: en ? "Accepted" : "Accepté",
    REJECTED: en ? "Declined" : "Refusé",
    CLOSED: en ? "Closed" : "Clôturé",
  };
  const orderStatuses: Record<string, string> = {
    OPEN: en ? "Unpaid" : "Impayée",
    PARTIALLY_PAID: en ? "Partially paid" : "Partiellement payée",
    PAID: en ? "Paid" : "Payée",
    CANCELLED: en ? "Cancelled" : "Annulée",
  };
  const formatMoney = (amount: number) => new Intl.NumberFormat(en ? "en-US" : "fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="admin-content admin-dashboard">
      <header className="admin-welcome">
        <div>
          <span className="admin-eyebrow">{en ? "SITOU DESIGN · ADMIN" : "SITOU DESIGN · ADMINISTRATION"}</span>
          <h1><AdminGreeting locale={locale} name={staff?.fullName ?? null} /></h1>
          <p>{en ? "A clear view of your content and the requests that need your attention." : "Retrouvez vos contenus et les demandes qui attendent votre attention."}</p>
        </div>
        <Link className="admin-dashboard-action" href={`/${locale}/admin/devis`}>
          {en ? "View quote requests" : "Voir les demandes"} <ArrowUpRight size={17} />
        </Link>
      </header>

      <section className="admin-stat-grid has-six" aria-label={en ? "Workspace overview" : "Résumé de l’espace"}>
        {stats.map(({ label, value, icon: Icon, href, tone, ...stat }) => (
          <Link className="admin-stat-card" href={href} key={label}>
            <span className={`admin-stat-icon is-${tone}`}><Icon size={20} aria-hidden="true" /></span>
            <span className="admin-stat-label">{label}</span>
            <strong>{stat.displayValue ? formatMoney(value) : value}</strong>
            <span className="admin-stat-link">{en ? "Open section" : "Ouvrir la rubrique"} <ArrowUpRight size={14} /></span>
          </Link>
        ))}
      </section>

      <DashboardRevenueChart data={revenueByDay} locale={locale} />

      <section className="admin-dashboard-recent-grid">
        <article className="admin-panel admin-dashboard-recent">
          <div className="admin-panel-heading">
            <div><h2>{en ? "Recent quote requests" : "Dernières demandes de devis"}</h2><p>{en ? "Latest customer inquiries received by the website." : "Les dernières demandes reçues depuis le site."}</p></div>
            <Link className="admin-inline-link" href={`/${locale}/admin/devis`}>{en ? "View all" : "Tout voir"} <ArrowUpRight size={14} /></Link>
          </div>
          {recentQuotes.length ? recentQuotes.map((quote) => (
            <div className="admin-dashboard-record" key={quote.id}>
              <span className="admin-dashboard-record-icon is-blue"><ReceiptText size={17} /></span>
              <span className="admin-dashboard-record-main"><strong>{quote.fullName}</strong><small>{quote.service} · {quote.reference.slice(0, 8)}</small></span>
              <span className={`admin-status-pill${quote.status === "NEW" || quote.status === "IN_PROGRESS" ? " is-warning" : " is-active"}`}>{quoteStatuses[quote.status]}</span>
              <time>{new Intl.DateTimeFormat(en ? "en-US" : "fr-FR", { day: "numeric", month: "short" }).format(quote.createdAt)}</time>
            </div>
          )) : <p className="admin-muted-copy">{en ? "No quote requests yet." : "Aucune demande pour le moment."}</p>}
        </article>

        <article className="admin-panel admin-dashboard-recent">
          <div className="admin-panel-heading">
            <div><h2>{en ? "Recent orders" : "Dernières commandes"}</h2><p>{en ? "Latest orders recorded in the workspace." : "Les commandes les plus récemment enregistrées."}</p></div>
            <Link className="admin-inline-link" href={`/${locale}/admin/commandes`}>{en ? "View all" : "Tout voir"} <ArrowUpRight size={14} /></Link>
          </div>
          {recentOrders.length ? recentOrders.map((order) => (
            <div className="admin-dashboard-record" key={order.id}>
              <span className="admin-dashboard-record-icon is-orange"><Banknote size={17} /></span>
              <span className="admin-dashboard-record-main"><strong>{order.orderNumber}</strong><small>{order.customerName} · {formatMoney(order.totalAmount)}</small></span>
              <span className={`admin-status-pill${order.status === "PAID" ? " is-active" : order.status === "CANCELLED" ? " is-danger" : " is-warning"}`}>{orderStatuses[order.status]}</span>
              <time>{new Intl.DateTimeFormat(en ? "en-US" : "fr-FR", { day: "numeric", month: "short" }).format(order.createdAt)}</time>
            </div>
          )) : <p className="admin-muted-copy">{en ? "No orders recorded yet." : "Aucune commande enregistrée."}</p>}
        </article>
      </section>

      <div className="admin-dashboard-lower">
        <section className="admin-panel admin-shortcuts">
          <div className="admin-panel-heading">
            <div>
              <h2>{en ? "Quick actions" : "Accès rapides"}</h2>
              <p>{en ? "Go straight to a task." : "Accédez directement à une action."}</p>
            </div>
          </div>
          {shortcuts.map(({ label, href, icon: Icon }) => (
            <Link className="admin-shortcut" href={href} key={href}>
              <span><Icon size={18} aria-hidden="true" /></span>
              <strong>{label}</strong>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </section>
        <section className="admin-dashboard-note">
          <span className="admin-dashboard-note-icon"><Plus size={21} /></span>
          <span className="admin-eyebrow">{en ? "YOUR WORKSPACE" : "VOTRE ESPACE"}</span>
          <h2>{en ? "Everything in its place." : "Tout au même endroit."}</h2>
          <p>{en ? "Manage your catalogue, business solutions and advice articles, then follow every quote request." : "Gérez votre catalogue, vos solutions entreprises et vos conseils, puis suivez chaque demande de devis."}</p>
          <Link href={`/${locale}/admin/solutions-entreprises`} className="admin-inline-link">{en ? "Manage public content" : "Gérer le contenu du site"} <ArrowUpRight size={15} /></Link>
        </section>
      </div>
    </div>
  );
}
