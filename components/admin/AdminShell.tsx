"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpenText,
  BriefcaseBusiness,
  Boxes,
  ChevronDown,
  ClipboardList,
  CreditCard,
  LogOut as LogOutIcon,
  FolderKanban,
  FolderOpen,
  FolderTree,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  ReceiptText,
  Sun,
  Users,
  Settings,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import type { StaffRole } from "@prisma/client";

const navItems = [
  { key: "dashboard", icon: LayoutDashboard, path: "" },
  { key: "quotes", icon: ClipboardList, path: "/devis" },
  { key: "cash", icon: CreditCard, path: "/caisse" },
  { key: "orders", icon: ReceiptText, path: "/commandes" },
  { key: "stock", icon: Boxes, path: "/stock" },
  { key: "reports", icon: BarChart3, path: "/rapports" },
  { key: "users", icon: Users, path: "/utilisateurs" },
  { key: "audit", icon: Activity, path: "/audit" },
] as const;

const contentNavItems = [
  { key: "products", icon: Package, path: "/produits" },
  { key: "categories", icon: FolderTree, path: "/categories" },
  { key: "services", icon: BriefcaseBusiness, path: "/services" },
  { key: "businessSolutions", icon: Lightbulb, path: "/solutions-entreprises" },
  { key: "articles", icon: BookOpenText, path: "/conseils" },
  { key: "portfolio", icon: FolderKanban, path: "/realisations" },
] as const;

export default function AdminShell({
  locale,
  role,
  canExportReports,
  fullName,
  email,
  children,
}: {
  locale: Locale;
  role: StaffRole;
  canExportReports: boolean;
  fullName: string;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const en = locale === "en";
  const accessibleContentNavItems = role === "ADMIN"
    ? contentNavItems
    : contentNavItems.filter(({ key }) => key === "products" || key === "categories");
  const [menuOpen, setMenuOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(() =>
    accessibleContentNavItems.some(({ path }) => pathname.startsWith(`/${locale}/admin${path}`)),
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const root = `/${locale}/admin`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("sitou-admin-theme");
      // Preferences are restored after hydration to keep the server markup deterministic.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "light" || stored === "dark" || stored === "system") setTheme(stored);
      setCollapsed(window.localStorage.getItem("sitou-admin-sidebar-collapsed") === "true");
    } catch (error) {
      console.error("Could not restore admin display preferences:", error);
      toast.error(en ? "Display preferences could not be restored." : "Impossible de restaurer les préférences d’affichage.");
    } finally {
      setPreferencesReady(true);
    }
  }, [en]);

  useEffect(() => {
    if (!preferencesReady) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const activeTheme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.adminTheme = activeTheme;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme, preferencesReady]);

  const labels = {
    dashboard: en ? "Overview" : "Vue d’ensemble",
    siteContent: en ? "Website content" : "Contenus du site",
    products: en ? "Products" : "Produits",
    categories: en ? "Categories" : "Catégories",
    services: en ? "Services" : "Services",
    businessSolutions: en ? "Business solutions" : "Solutions entreprises",
    articles: en ? "Insights & advice" : "Conseils",
    portfolio: en ? "Portfolio" : "Réalisations",
    quotes: en ? "Quote requests" : "Demandes de devis",
    cash: en ? "Cash register" : "Gestion de caisse",
    orders: en ? "Orders & invoices" : "Commandes & factures",
    stock: en ? "Inventory" : "Gestion de stock",
    reports: en ? "Reports" : "Rapports",
    users: en ? "Team accounts" : "Comptes utilisateurs",
    audit: en ? "Audit log" : "Journal d’audit",
  };
  const canManageContent = role !== "CASHIER";
  const visibleNavItems = navItems.filter(({ key }) => key !== "dashboard" && (role === "ADMIN"
    || key === "cash" || key === "orders" || key === "stock"
    || (key === "reports" && canExportReports)));
  const activeItem = navItems.find(({ path }) =>
    path === "" ? pathname === root || pathname === `${root}/` : pathname.startsWith(`${root}${path}`),
  );
  const activeContentItem = accessibleContentNavItems.find(({ path }) => pathname.startsWith(`${root}${path}`));
  const pageTitle = activeItem
    ? labels[activeItem.key]
    : activeContentItem
      ? labels[activeContentItem.key]
      : (en ? "Workspace" : "Espace de travail");
  const profileInitial = fullName.trim().charAt(0).toUpperCase() || "S";

  const logout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error(en ? "Sign out failed." : "La déconnexion a échoué.");
      router.replace(`/${locale}/connexion-admin`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : en ? "Sign out failed." : "La déconnexion a échoué.");
      setLoggingOut(false);
    }
  };

  const sidebar = (
    <>
      <Link className="admin-brand" href={root} onClick={() => setMenuOpen(false)}>
        <span className="admin-brand-mark">S</span>
        <span>
          <strong>Sitou Design</strong>
          <small>{en ? "ADMIN WORKSPACE" : "ESPACE ADMIN"}</small>
        </span>
      </Link>

      <div className="admin-nav-label">{en ? "WORKSPACE" : "ESPACE DE TRAVAIL"}</div>
      <nav className="admin-nav" aria-label={en ? "Admin navigation" : "Navigation admin"}>
        {navItems.filter(({ key }) => key === "dashboard").map(({ key, icon: Icon, path }) => {
          const href = `${root}${path}`;
          const active = pathname === root || pathname === `${root}/`;
          return (
            <Link
              className={`admin-nav-link${active ? " is-active" : ""}`}
              href={href}
              key={key}
              title={collapsed ? labels[key] : undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{labels[key]}</span>
            </Link>
          );
        })}
        {canManageContent && (
          <div className={`admin-nav-group${accessibleContentNavItems.some(({ path }) => pathname.startsWith(`${root}${path}`)) ? " is-active" : ""}`}>
            <button
              type="button"
              className="admin-nav-link admin-nav-group-trigger"
              title={collapsed ? labels.siteContent : undefined}
              aria-expanded={contentOpen}
              onClick={() => setContentOpen((open) => !open)}
            >
              <FolderOpen size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{labels.siteContent}</span>
              <ChevronDown className="admin-nav-group-chevron" size={15} aria-hidden="true" />
            </button>
            {contentOpen && (
              <div className="admin-nav-subitems">
                {accessibleContentNavItems.map(({ key, icon: Icon, path }) => {
                  const href = `${root}${path}`;
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      className={`admin-nav-link admin-nav-sublink${active ? " is-active" : ""}`}
                      href={href}
                      key={key}
                      title={collapsed ? labels[key] : undefined}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                      <span>{labels[key]}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {visibleNavItems.map(({ key, icon: Icon, path }) => {
          const href = `${root}${path}`;
          const active = path === ""
            ? pathname === root || pathname === `${root}/`
            : pathname.startsWith(href);
          return (
            <Link
              className={`admin-nav-link${active ? " is-active" : ""}`}
              href={href}
              key={key}
              title={collapsed ? labels[key] : undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{labels[key]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-bottom">
        {role === "ADMIN" && (
          <Link
            className={`admin-nav-link${pathname.startsWith(`${root}/parametres`) ? " is-active" : ""}`}
            href={`${root}/parametres`}
            title={collapsed ? (en ? "Settings" : "Paramètres") : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{en ? "Settings" : "Paramètres"}</span>
          </Link>
        )}
        <Link className="admin-back-link" href={`/${locale}`} onClick={() => setMenuOpen(false)}>
          <ArrowLeft size={17} aria-hidden="true" />
          <span>{en ? "Back to website" : "Retour au site"}</span>
        </Link>
        <button
          type="button"
          className="admin-logout-button"
          onClick={logout}
          disabled={loggingOut}
        >
          <LogOut size={18} aria-hidden="true" />
          <span>{loggingOut ? (en ? "Signing out…" : "Déconnexion…") : (en ? "Sign out" : "Déconnexion")}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className={`admin-layout${collapsed ? " is-collapsed" : ""}`}>
      <aside className="admin-sidebar">{sidebar}</aside>
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <div className="admin-mobile-header">
          <Link className="admin-mobile-brand" href={root}>
            <span className="admin-brand-mark">S</span>
            <strong>Sitou Design</strong>
          </Link>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="admin-mobile-toggle"
              aria-label={menuOpen ? (en ? "Close menu" : "Fermer le menu") : (en ? "Open menu" : "Ouvrir le menu")}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="admin-mobile-dialog-overlay" />
          <Dialog.Content className="admin-sidebar admin-sidebar-mobile">
            <Dialog.Title className="sr-only">{en ? "Admin navigation" : "Navigation admin"}</Dialog.Title>
            {sidebar}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-heading">
            <button
              type="button"
              className="admin-collapse-button"
              aria-label={collapsed ? (en ? "Expand sidebar" : "Développer le menu") : (en ? "Collapse sidebar" : "Réduire le menu")}
              aria-pressed={collapsed}
              onClick={() => {
                const nextValue = !collapsed;
                setCollapsed(nextValue);
                try {
                  window.localStorage.setItem("sitou-admin-sidebar-collapsed", String(nextValue));
                } catch (error) {
                  console.error("Could not save admin sidebar preference:", error);
                  toast.error(en ? "Sidebar preference could not be saved." : "Impossible d’enregistrer la préférence de navigation.");
                }
              }}
            >
              {collapsed ? <Menu size={18} /> : <X size={18} />}
            </button>
            <div><span className="admin-topbar-crumb">{en ? "Workspace" : "Espace de travail"}</span><strong>{pageTitle}</strong></div>
          </div>
          <div className="admin-topbar-actions">
            <LiveClock locale={locale} />
            <label className="admin-theme-switch">
              <span className="sr-only">{en ? "Color theme" : "Thème de couleur"}</span>
              {theme === "light" ? <Sun size={16} aria-hidden="true" /> : theme === "dark" ? <Moon size={16} aria-hidden="true" /> : <Monitor size={16} aria-hidden="true" />}
              <select
                aria-label={en ? "Color theme" : "Thème de couleur"}
                value={theme}
                onChange={(event) => {
                  const selected = event.target.value;
                  if (selected !== "light" && selected !== "dark" && selected !== "system") return;
                  const nextTheme = selected;
                  setTheme(nextTheme);
                  try {
                    window.localStorage.setItem("sitou-admin-theme", nextTheme);
                  } catch (error) {
                    console.error("Could not save admin theme preference:", error);
                    toast.error(en ? "Theme preference could not be saved." : "Impossible d’enregistrer la préférence de thème.");
                  }
                }}
              >
                <option value="light">{en ? "Light" : "Clair"}</option>
                <option value="dark">{en ? "Dark" : "Sombre"}</option>
                <option value="system">{en ? "System" : "Système"}</option>
              </select>
            </label>
            <DropdownMenu.Root open={profileOpen} onOpenChange={setProfileOpen}>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="admin-profile-trigger" aria-label={en ? `Account menu for ${fullName}` : `Menu du compte de ${fullName}`}>
                  <span className="admin-profile-avatar">{profileInitial}</span>
                  <span className="admin-profile-copy"><strong>{fullName}</strong><small>{role === "ADMIN" ? (en ? "Administrator" : "Administrateur") : role === "MANAGER" ? "Manager" : (en ? "Cashier" : "Caissier")}</small></span>
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="admin-profile-menu" align="end" sideOffset={8}>
                  <DropdownMenu.Label className="admin-profile-summary">
                    <strong>{fullName}</strong>
                    <span>{email}</span>
                    <small>{role === "ADMIN" ? (en ? "Administrator" : "Administrateur") : role === "MANAGER" ? "Manager" : (en ? "Cashier" : "Caissier")}</small>
                  </DropdownMenu.Label>
                  <DropdownMenu.Separator className="admin-profile-separator" />
                  <DropdownMenu.Item asChild>
                    <Link href={`${root}/parametres`}><Settings size={16} aria-hidden="true" />{en ? "Settings" : "Paramètres"}</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="admin-profile-menu-action"
                    disabled={loggingOut}
                    onSelect={() => void logout()}
                  >
                    <LogOutIcon size={16} aria-hidden="true" />
                    {loggingOut ? (en ? "Signing out…" : "Déconnexion…") : (en ? "Sign out" : "Déconnexion")}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        {children}
        <Toaster position="top-right" theme={theme} closeButton />
      </main>
    </div>
  );
}

function LiveClock({ locale }: { locale: Locale }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time className="admin-live-clock" dateTime={now?.toISOString()}>
      <span>{now ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now) : "--:--:--"}</span>
      <small>{now ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(now) : ""}</small>
    </time>
  );
}
