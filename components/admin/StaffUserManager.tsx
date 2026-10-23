"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import { ADMIN_PAGE_SIZES, type AdminPageSize } from "@/lib/admin-pagination";

type StaffUser = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  isActive: boolean;
  mustChangePassword: boolean;
  maxDiscountPercent: number;
  canApproveRefunds: boolean;
  canApproveExpenses: boolean;
  canExportReports: boolean;
};

type Pagination = { page: number; pageSize: AdminPageSize; total: number; totalPages: number };

function readPaginationFromUrl(): Pick<Pagination, "page" | "pageSize"> {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: ADMIN_PAGE_SIZES.includes(pageSize as AdminPageSize) ? pageSize as AdminPageSize : 25,
  };
}

function updatePaginationUrl(page: number, pageSize: AdminPageSize, mode: "push" | "replace" = "push") {
  const url = new URL(window.location.href);
  if (page === 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  if (pageSize === 25) url.searchParams.delete("pageSize");
  else url.searchParams.set("pageSize", String(pageSize));
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function StaffUserManager() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<"MANAGER" | "CASHIER">("CASHIER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pagination.page), pageSize: String(pagination.pageSize) });
      const response = await fetch(`/api/admin/utilisateurs?${params}`, { cache: "no-store" });
      const data: { users?: StaffUser[]; pagination?: Pagination; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(data.users) || !data.pagination) {
        throw new Error(data.error || "Impossible de charger les comptes.");
      }
      setUsers(data.users);
      setPagination(data.pagination);
      if (data.pagination.page !== pagination.page) {
        updatePaginationUrl(data.pagination.page, data.pagination.pageSize, "replace");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les comptes.");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize]);

  useEffect(() => {
    const restorePagination = () => setPagination((current) => ({ ...current, ...readPaginationFromUrl() }));
    restorePagination();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialized(true);
    window.addEventListener("popstate", restorePagination);
    return () => window.removeEventListener("popstate", restorePagination);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialized) void loadUsers();
  }, [initialized, loadUsers]);

  function changePage(page: number) {
    const nextPage = Math.max(1, Math.min(page, pagination.totalPages));
    setPagination((current) => ({ ...current, page: nextPage }));
    updatePaginationUrl(nextPage, pagination.pageSize);
  }

  function changePageSize(pageSize: AdminPageSize) {
    setPagination((current) => ({ ...current, page: 1, pageSize }));
    updatePaginationUrl(1, pageSize);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setTemporaryPassword("");
    try {
      const response = await fetch("/api/admin/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, role: newRole }),
      });
      const data: { error?: string; temporaryPassword?: string } = await response.json();
      if (!response.ok || !data.temporaryPassword) throw new Error(data.error || "Impossible de créer le compte.");
      setTemporaryPassword(data.temporaryPassword);
      setFullName("");
      setEmail("");
      setNewRole("CASHIER");
      toast.success("Compte créé. Copie le mot de passe temporaire pour le transmettre au caissier.");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer le compte.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: StaffUser, changes: Partial<StaffUser> & { resetPassword?: boolean }) {
    try {
      const response = await fetch(`/api/admin/utilisateurs/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data: { error?: string; temporaryPassword?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de modifier ce compte.");
      if (data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword);
        toast.success("Nouveau mot de passe temporaire généré.");
      } else {
        toast.success("Permissions mises à jour.");
      }
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier ce compte.");
    }
  }

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">SÉCURITÉ & ÉQUIPE</span>
          <h1>Comptes utilisateurs</h1>
          <p>Un compte personnel par caissier, avec des permissions accordées par le responsable.</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={() => setCreateOpen(true)}><Plus size={17} />Créer un compte</button>
      </header>

      <AdminDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Ajouter un compte"
        description="Choisis le rôle adapté. Un mot de passe temporaire à usage unique sera généré."
        closeLabel="Fermer le formulaire"
      >
        <form onSubmit={createUser}>
          <div className="admin-form-grid">
            <label>Nom complet<input required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            <label>Adresse e-mail<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Rôle<select value={newRole} onChange={(event) => setNewRole(event.target.value as "MANAGER" | "CASHIER")}><option value="CASHIER">Caissier</option><option value="MANAGER">Manager</option></select></label>
          </div>
          <div className="admin-form-actions admin-dialog-form-actions">
            <button type="button" className="admin-quiet-button" onClick={() => setCreateOpen(false)} disabled={saving}>Annuler</button>
            <button type="submit" className="admin-primary-button" disabled={saving}>
              {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />} Créer le compte
            </button>
          </div>
        </form>
      </AdminDialog>

      {temporaryPassword && (
        <section className="admin-one-time-secret" role="status">
          <KeyRound size={18} />
          <div><strong>Mot de passe temporaire — à copier maintenant</strong><code>{temporaryPassword}</code><span>Il ne sera pas réaffiché. Le caissier devra en choisir un nouveau à sa première connexion.</span></div>
          <button type="button" className="admin-quiet-button" onClick={() => void navigator.clipboard.writeText(temporaryPassword)}>Copier</button>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Équipe</h2><p>Les comptes sont paginés ; les permissions sensibles restent contrôlées côté serveur.</p></div><Users size={20} /></div>
        {loading ? <div className="admin-empty-state"><LoaderCircle className="animate-spin" />Chargement des comptes…</div> : users.length ? (
          <div className="admin-service-list">
            {users.map((user) => (
              <article className="admin-service-row" key={user.id}>
                <span className="admin-stat-icon is-violet">{user.role === "ADMIN" ? <ShieldCheck size={18} /> : <UserRound size={18} />}</span>
                <div className="admin-service-copy">
                  <div className="admin-service-title-row"><h3>{user.fullName}</h3><span className={`admin-status-pill${user.isActive ? " is-active" : ""}`}>{user.role === "ADMIN" ? "Administrateur" : user.role === "MANAGER" ? (user.isActive ? "Manager" : "Manager désactivé") : user.isActive ? "Caissier actif" : "Caissier désactivé"}</span></div>
                  <p>{user.email}</p>
                  {user.role === "CASHIER" && <small>Remise max. {user.maxDiscountPercent}% · Remboursements {user.canApproveRefunds ? "autorisés" : "non autorisés"} · Dépenses {user.canApproveExpenses ? "autorisées" : "à approuver"}</small>}
                </div>
                {user.role !== "ADMIN" && (
                  <div className="admin-user-actions">
                    <label className="admin-user-permission">Rôle<select value={user.role} onChange={(event) => void updateUser(user, { role: event.target.value as "MANAGER" | "CASHIER" })}><option value="CASHIER">Caissier</option><option value="MANAGER">Manager</option></select></label>
                    {user.role === "CASHIER" && <>
                      <label className="admin-user-permission">Remise max. <input type="number" min={0} max={100} defaultValue={user.maxDiscountPercent} onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (value !== user.maxDiscountPercent) void updateUser(user, { maxDiscountPercent: value });
                      }} /> %</label>
                      <label className="admin-user-permission"><input type="checkbox" checked={user.canApproveExpenses} onChange={(event) => void updateUser(user, { canApproveExpenses: event.target.checked })} /> Approuver dépenses</label>
                      <label className="admin-user-permission"><input type="checkbox" checked={user.canApproveRefunds} onChange={(event) => void updateUser(user, { canApproveRefunds: event.target.checked })} /> Approuver remboursements</label>
                    </>}
                    <label className="admin-user-permission"><input type="checkbox" checked={user.canExportReports} onChange={(event) => void updateUser(user, { canExportReports: event.target.checked })} /> Accéder aux rapports</label>
                    <button type="button" className="admin-quiet-button" onClick={() => void updateUser(user, { resetPassword: true })}><KeyRound size={15} /> Réinitialiser le mot de passe</button>
                    <button type="button" className="admin-quiet-button" onClick={() => void updateUser(user, { isActive: !user.isActive })}>{user.isActive ? "Désactiver" : "Réactiver"}</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : <div className="admin-empty-state"><Users size={22} /><strong>Aucun compte utilisateur</strong><span>Crée un compte pour commencer à gérer l’équipe.</span></div>}
        {!loading && <AdminPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />}
      </section>
    </div>
  );
}
