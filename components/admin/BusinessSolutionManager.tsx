"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BriefcaseBusiness, Check, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import ContentImageField from "@/components/admin/ContentImageField";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminLocalPagination } from "@/lib/use-admin-local-pagination";

type Solution = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  coverImage: string | null;
  isActive: boolean;
  sortOrder: number;
};

type SolutionForm = Omit<Solution, "id" | "coverImage"> & { coverImage: string };

const blankForm: SolutionForm = {
  slug: "",
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  coverImage: "",
  isActive: true,
  sortOrder: 0,
};

function slugify(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function BusinessSolutionManager({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [form, setForm] = useState<SolutionForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingSolution, setDeletingSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { pageItems: pageSolutions, paginationProps: solutionPagination } =
    useAdminLocalPagination(solutions);

  const loadSolutions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/solutions-entreprises", { cache: "no-store" });
      const data: { solutions?: Solution[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not load solutions." : "Impossible de charger les solutions."));
      if (!Array.isArray(data.solutions)) throw new Error(en ? "The response is invalid." : "La réponse reçue est invalide.");
      setSolutions(data.solutions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not load solutions." : "Impossible de charger les solutions."));
    } finally {
      setLoading(false);
    }
  }, [en]);

  // The initial list is fetched from the protected admin API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSolutions(); }, [loadSolutions]);

  const openNew = () => {
    setEditingId(null);
    setForm(blankForm);
    setFormOpen(true);
  };

  const openEdit = (solution: Solution) => {
    const { id, ...values } = solution;
    setEditingId(id);
    setForm({ ...values, coverImage: values.coverImage ?? "" });
    setFormOpen(true);
  };

  const update = <K extends keyof SolutionForm>(key: K, value: SolutionForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/admin/solutions-entreprises/${editingId}` : "/api/admin/solutions-entreprises",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, slug: slugify(form.slug), coverImage: form.coverImage.trim() }),
        },
      );
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not save solution." : "Impossible d’enregistrer la solution."));
      toast.success(editingId ? (en ? "Solution updated." : "Solution modifiée.") : (en ? "Solution created." : "Solution créée."));
      setFormOpen(false);
      await loadSolutions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not save solution." : "Impossible d’enregistrer la solution."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (solution: Solution) => {
    try {
      const response = await fetch(`/api/admin/solutions-entreprises/${solution.id}`, { method: "DELETE" });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not delete solution." : "Impossible de supprimer la solution."));
      toast.success(en ? "Solution deleted." : "Solution supprimée.");
      setDeletingSolution(null);
      await loadSolutions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not delete solution." : "Impossible de supprimer la solution."));
    }
  };

  const importCurrent = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/solutions-entreprises/import-current", { method: "POST" });
      const data: { solutions?: Solution[]; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(data.solutions)) throw new Error(data.error || (en ? "Could not import current content." : "Impossible d’importer le contenu actuel."));
      setSolutions(data.solutions);
      toast.success(en ? "Current solutions imported." : "Les solutions actuelles ont été importées.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not import current content." : "Impossible d’importer le contenu actuel."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">{en ? "PUBLIC CONTENT" : "CONTENU DU SITE"}</span>
          <h1>{en ? "Business solutions" : "Solutions entreprises"}</h1>
          <p>{en ? "Manage the solutions displayed on your website." : "Gérez les solutions présentées sur votre site."}</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={openNew}>
          <Plus size={18} /> {en ? "Add a solution" : "Ajouter une solution"}
        </button>
      </header>

      <div className="admin-summary-strip">
        <span><BriefcaseBusiness size={17} /> {solutions.length} {en ? "solutions" : "solutions"}</span>
        <span><Check size={17} /> {solutions.filter((solution) => solution.isActive).length} {en ? "visible on website" : "visibles sur le site"}</span>
        <button type="button" className="admin-quiet-button" onClick={() => { setLoading(true); void loadSolutions(); }} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} /> {en ? "Refresh" : "Actualiser"}
        </button>
      </div>

      {formOpen && (
        <AdminDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          title={editingId ? (en ? "Edit solution" : "Modifier la solution") : (en ? "New solution" : "Nouvelle solution")}
          description={en ? "Complete both languages for a consistent experience." : "Renseignez les deux langues pour une présentation complète."}
          closeLabel={en ? "Close form" : "Fermer le formulaire"}
        >
        <form className="admin-dialog-form" onSubmit={save}>
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">{en ? "BILINGUAL CONTENT" : "CONTENU BILINGUE"}</span>
              <span className="admin-eyebrow">{en ? "BILINGUAL CONTENT" : "CONTENU BILINGUE"}</span>
            </div>
          </div>
          <div className="admin-form-section">
            <h3>{en ? "Content" : "Contenu"}</h3>
            <div className="admin-form-grid">
              <label>{en ? "Title · French" : "Titre · français"}<input required minLength={2} maxLength={160} value={form.titleFr} onChange={(event) => {
                const titleFr = event.target.value;
                setForm((current) => ({ ...current, titleFr, slug: editingId ? current.slug : slugify(titleFr) }));
              }} /></label>
              <label>{en ? "Title · English" : "Titre · anglais"}<input required minLength={2} maxLength={160} value={form.titleEn} onChange={(event) => update("titleEn", event.target.value)} /></label>
              <label>{en ? "Description · French" : "Description · français"}<textarea required minLength={5} maxLength={2000} rows={4} value={form.descriptionFr} onChange={(event) => update("descriptionFr", event.target.value)} /></label>
              <label>{en ? "Description · English" : "Description · anglais"}<textarea required minLength={5} maxLength={2000} rows={4} value={form.descriptionEn} onChange={(event) => update("descriptionEn", event.target.value)} /></label>
              <ContentImageField value={form.coverImage} onChange={(coverImage) => update("coverImage", coverImage)} label={en ? "Solution image" : "Image de la solution"} uploadLabel={en ? "Upload image" : "Téléverser une image"} removeLabel={en ? "Remove image" : "Retirer l’image"} />
            </div>
          </div>
          <div className="admin-form-section">
            <h3>{en ? "Display settings" : "Paramètres d’affichage"}</h3>
            <div className="admin-form-grid">
              <label className="admin-form-full">{en ? "URL identifier" : "Identifiant URL"}<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => update("slug", slugify(event.target.value))} /><small>{en ? "Lowercase letters, numbers and hyphens." : "Minuscules, chiffres et tirets uniquement."}</small></label>
              <label>{en ? "Display order" : "Ordre d’affichage"}<input type="number" min={0} max={10000} value={form.sortOrder} onChange={(event) => update("sortOrder", Number(event.target.value))} /></label>
              <label className="admin-checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} />{en ? "Visible on the website" : "Visible sur le site"}</label>
            </div>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-quiet-button" onClick={() => setFormOpen(false)}>{en ? "Cancel" : "Annuler"}</button>
            <button type="submit" className="admin-primary-button" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" size={17} />}
              {saving ? (en ? "Saving…" : "Enregistrement…") : (en ? "Save solution" : "Enregistrer la solution")}
            </button>
          </div>
        </form>
        </AdminDialog>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>{en ? "Your business solutions" : "Vos solutions entreprises"}</h2><p>{en ? "Active entries are shown on the public page." : "Les éléments actifs sont affichés sur la page publique."}</p></div>
        </div>
        {loading ? (
          <div className="admin-empty-state"><LoaderCircle className="animate-spin" size={24} />{en ? "Loading solutions…" : "Chargement des solutions…"}</div>
        ) : solutions.length === 0 ? (
          <div className="admin-empty-state">
            <BriefcaseBusiness size={26} />
            <strong>{en ? "No solutions saved yet" : "Aucune solution enregistrée"}</strong>
            <span>{en ? "Import 15 editable business solution ideas with starter images, or create your own." : "Importez 15 idées modifiables avec des images de départ, ou créez vos propres solutions."}</span>
            <div className="admin-empty-actions">
              <button type="button" className="admin-quiet-button" onClick={() => void importCurrent()} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />}{en ? "Import starter solutions" : "Importer les 15 solutions de départ"}</button>
              <button type="button" className="admin-primary-button" onClick={openNew}><Plus size={17} />{en ? "Create a solution" : "Créer une solution"}</button>
            </div>
          </div>
        ) : (
          <div className="admin-service-list">
            {pageSolutions.map((solution) => (
              <article className="admin-service-row" key={solution.id}>
                <span className="admin-service-order">{String(solution.sortOrder).padStart(2, "0")}</span>
                <div className="admin-service-copy">
                  <div className="admin-service-title-row">
                    <h3>{locale === "fr" ? solution.titleFr : solution.titleEn}</h3>
                    <span className={`admin-status-pill${solution.isActive ? " is-active" : ""}`}>{solution.isActive ? (en ? "Visible" : "Visible") : (en ? "Hidden" : "Masquée")}</span>
                  </div>
                  <p>{locale === "fr" ? solution.descriptionFr : solution.descriptionEn}</p>
                  <small>/{solution.slug}</small>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="admin-icon-button" onClick={() => openEdit(solution)} aria-label={en ? "Edit solution" : "Modifier la solution"}><Pencil size={17} /></button>
                  <button type="button" className="admin-icon-button is-danger" onClick={() => setDeletingSolution(solution)} aria-label={en ? "Delete solution" : "Supprimer la solution"}><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {!loading && solutions.length > 0 && (
        <AdminPagination {...solutionPagination} />
      )}
      <AdminConfirmDialog
        open={Boolean(deletingSolution)}
        onOpenChange={(open) => { if (!open) setDeletingSolution(null); }}
        title={en ? "Delete this solution?" : "Supprimer cette solution ?"}
        description={deletingSolution ? (en ? `“${deletingSolution.titleEn}” will be permanently removed.` : `« ${deletingSolution.titleFr} » sera définitivement supprimée.`) : ""}
        cancelLabel={en ? "Cancel" : "Annuler"}
        confirmLabel={en ? "Delete solution" : "Supprimer la solution"}
        onConfirm={() => { if (deletingSolution) void remove(deletingSolution); }}
      />
    </div>
  );
}
