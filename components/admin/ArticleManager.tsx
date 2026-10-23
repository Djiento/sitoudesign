"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookOpenText, Check, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import ContentImageField from "@/components/admin/ContentImageField";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminLocalPagination } from "@/lib/use-admin-local-pagination";

type Article = {
  id: string;
  slug: string;
  category: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string | null;
  excerptEn: string | null;
  contentFr: string;
  contentEn: string;
  coverImage: string | null;
  isPublished: boolean;
  publishedAt: string | null;
};

type ArticleForm = {
  slug: string;
  category: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  contentFr: string;
  contentEn: string;
  coverImage: string;
  isPublished: boolean;
};

const blankForm: ArticleForm = {
  slug: "",
  category: "Conseils pratiques",
  titleFr: "",
  titleEn: "",
  excerptFr: "",
  excerptEn: "",
  contentFr: "",
  contentEn: "",
  coverImage: "",
  isPublished: false,
};

function slugify(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ArticleManager({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [articles, setArticles] = useState<Article[]>([]);
  const [form, setForm] = useState<ArticleForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { pageItems: pageArticles, paginationProps: articlePagination } =
    useAdminLocalPagination(articles);

  const loadArticles = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/articles", { cache: "no-store" });
      const data: { articles?: Article[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not load articles." : "Impossible de charger les articles."));
      if (!Array.isArray(data.articles)) throw new Error(en ? "The response is invalid." : "La réponse reçue est invalide.");
      setArticles(data.articles);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not load articles." : "Impossible de charger les articles."));
    } finally {
      setLoading(false);
    }
  }, [en]);

  // The initial list is fetched from the protected admin API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadArticles(); }, [loadArticles]);

  const openNew = () => {
    setEditingId(null);
    setForm(blankForm);
    setFormOpen(true);
  };

  const openEdit = (article: Article) => {
    setEditingId(article.id);
    setForm({
      slug: article.slug,
      category: article.category,
      titleFr: article.titleFr,
      titleEn: article.titleEn,
      excerptFr: article.excerptFr ?? "",
      excerptEn: article.excerptEn ?? "",
      contentFr: article.contentFr,
      contentEn: article.contentEn,
      coverImage: article.coverImage ?? "",
      isPublished: article.isPublished,
    });
    setFormOpen(true);
  };

  const update = <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/admin/articles/${editingId}` : "/api/admin/articles",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, slug: slugify(form.slug), coverImage: form.coverImage.trim() }),
        },
      );
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not save article." : "Impossible d’enregistrer l’article."));
      toast.success(editingId ? (en ? "Article updated." : "Article modifié.") : (en ? "Article created." : "Article créé."));
      setFormOpen(false);
      await loadArticles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not save article." : "Impossible d’enregistrer l’article."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (article: Article) => {
    try {
      const response = await fetch(`/api/admin/articles/${article.id}`, { method: "DELETE" });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not delete article." : "Impossible de supprimer l’article."));
      toast.success(en ? "Article deleted." : "Article supprimé.");
      setDeletingArticle(null);
      await loadArticles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not delete article." : "Impossible de supprimer l’article."));
    }
  };

  const importCurrent = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/articles/import-current", { method: "POST" });
      const data: { articles?: Article[]; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(data.articles)) throw new Error(data.error || (en ? "Could not import current articles." : "Impossible d’importer les conseils actuels."));
      setArticles(data.articles);
      toast.success(en ? "Current articles imported. Existing entries were kept unchanged." : "Les conseils actuels sont importés. Les articles existants ont été conservés.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not import current articles." : "Impossible d’importer les conseils actuels."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">{en ? "PUBLIC CONTENT" : "CONTENU DU SITE"}</span>
          <h1>{en ? "Insights & advice" : "Conseils & inspirations"}</h1>
          <p>{en ? "Create, edit and publish bilingual articles." : "Créez, modifiez et publiez vos articles en français et en anglais."}</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={openNew}>
          <Plus size={18} /> {en ? "Add an article" : "Ajouter un article"}
        </button>
      </header>

      <div className="admin-summary-strip">
        <span><BookOpenText size={17} /> {articles.length} {en ? "articles" : "articles"}</span>
        <span><Check size={17} /> {articles.filter((article) => article.isPublished).length} {en ? "published" : "publiés"}</span>
        <button type="button" className="admin-quiet-button" onClick={() => void importCurrent()} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />} {en ? "Import existing guides" : "Importer les conseils existants"}
        </button>
        <button type="button" className="admin-quiet-button" onClick={() => { setLoading(true); void loadArticles(); }} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} /> {en ? "Refresh" : "Actualiser"}
        </button>
      </div>

      {formOpen && (
        <AdminDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          title={editingId ? (en ? "Edit article" : "Modifier l’article") : (en ? "New article" : "Nouvel article")}
          description={en ? "Write and review both language versions before publishing." : "Rédigez les deux versions avant de publier l’article."}
          closeLabel={en ? "Close form" : "Fermer le formulaire"}
        >
        <form className="admin-dialog-form" onSubmit={save}>
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">{en ? "EDITORIAL" : "ÉDITION"}</span>
              <span className="admin-eyebrow">{en ? "EDITORIAL" : "ÉDITION"}</span>
            </div>
          </div>
          <div className="admin-form-section">
            <h3>{en ? "Article details" : "Informations de l’article"}</h3>
            <div className="admin-form-grid">
              <label>{en ? "Title · French" : "Titre · français"}<input required minLength={2} maxLength={180} value={form.titleFr} onChange={(event) => {
                const titleFr = event.target.value;
                setForm((current) => ({ ...current, titleFr, slug: editingId ? current.slug : slugify(titleFr) }));
              }} /></label>
              <label>{en ? "Title · English" : "Titre · anglais"}<input required minLength={2} maxLength={180} value={form.titleEn} onChange={(event) => update("titleEn", event.target.value)} /></label>
              <label>{en ? "Category" : "Catégorie"}<input required minLength={2} maxLength={100} value={form.category} onChange={(event) => update("category", event.target.value)} /></label>
              <label className="admin-form-full">{en ? "URL identifier" : "Identifiant URL"}<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => update("slug", slugify(event.target.value))} /><small>{en ? "Lowercase letters, numbers and hyphens only." : "Minuscules, chiffres et tirets uniquement."}</small></label>
              <label>{en ? "Summary · French" : "Résumé · français"}<textarea required minLength={5} maxLength={500} rows={3} value={form.excerptFr} onChange={(event) => update("excerptFr", event.target.value)} /></label>
              <label>{en ? "Summary · English" : "Résumé · anglais"}<textarea required minLength={5} maxLength={500} rows={3} value={form.excerptEn} onChange={(event) => update("excerptEn", event.target.value)} /></label>
            </div>
          </div>
          <div className="admin-form-section">
            <h3>{en ? "Article text" : "Texte de l’article"}</h3>
            <p className="admin-form-helper">{en ? "Separate paragraphs with a blank line." : "Séparez les paragraphes par une ligne vide."}</p>
            <div className="admin-form-grid">
              <label>{en ? "Content · French" : "Contenu · français"}<textarea required minLength={20} maxLength={20000} rows={11} value={form.contentFr} onChange={(event) => update("contentFr", event.target.value)} /></label>
              <label>{en ? "Content · English" : "Contenu · anglais"}<textarea required minLength={20} maxLength={20000} rows={11} value={form.contentEn} onChange={(event) => update("contentEn", event.target.value)} /></label>
              <ContentImageField value={form.coverImage} onChange={(coverImage) => update("coverImage", coverImage)} label={en ? "Cover image (optional)" : "Image de couverture (facultatif)"} uploadLabel={en ? "Upload image" : "Téléverser une image"} removeLabel={en ? "Remove image" : "Retirer l’image"} />
              <label className="admin-checkbox-row"><input type="checkbox" checked={form.isPublished} onChange={(event) => update("isPublished", event.target.checked)} />{en ? "Publish on the website" : "Publier sur le site"}</label>
            </div>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-quiet-button" onClick={() => setFormOpen(false)}>{en ? "Cancel" : "Annuler"}</button>
            <button type="submit" className="admin-primary-button" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" size={17} />}
              {saving ? (en ? "Saving…" : "Enregistrement…") : (en ? "Save article" : "Enregistrer l’article")}
            </button>
          </div>
        </form>
        </AdminDialog>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>{en ? "Your articles" : "Vos articles"}</h2><p>{en ? "Published articles appear in the Insights section." : "Les articles publiés apparaissent dans la rubrique Conseils."}</p></div>
        </div>
        {loading ? (
          <div className="admin-empty-state"><LoaderCircle className="animate-spin" size={24} />{en ? "Loading articles…" : "Chargement des articles…"}</div>
        ) : articles.length === 0 ? (
          <div className="admin-empty-state">
            <BookOpenText size={26} />
            <strong>{en ? "No articles saved yet" : "Aucun article enregistré"}</strong>
            <span>{en ? "Import 15 editable starter guides with cover images, or create your own article." : "Importez 15 conseils modifiables avec leurs images, ou créez vos propres articles."}</span>
            <div className="admin-empty-actions">
              <button type="button" className="admin-quiet-button" onClick={() => void importCurrent()} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />}{en ? "Import 15 starter guides" : "Importer les 15 conseils de départ"}</button>
              <button type="button" className="admin-primary-button" onClick={openNew}><Plus size={17} />{en ? "Create an article" : "Créer un article"}</button>
            </div>
          </div>
        ) : (
          <div className="admin-service-list">
            {pageArticles.map((article) => (
              <article className="admin-service-row" key={article.id}>
                <span className="admin-service-order"><BookOpenText size={17} /></span>
                <div className="admin-service-copy">
                  <div className="admin-service-title-row">
                    <h3>{locale === "fr" ? article.titleFr : article.titleEn}</h3>
                    <span className={`admin-status-pill${article.isPublished ? " is-active" : ""}`}>{article.isPublished ? (en ? "Published" : "Publié") : (en ? "Draft" : "Brouillon")}</span>
                  </div>
                  <p>{locale === "fr" ? article.excerptFr : article.excerptEn}</p>
                  <small>{article.category} · /{article.slug}</small>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="admin-icon-button" onClick={() => openEdit(article)} aria-label={en ? "Edit article" : "Modifier l’article"}><Pencil size={17} /></button>
                  <button type="button" className="admin-icon-button is-danger" onClick={() => setDeletingArticle(article)} aria-label={en ? "Delete article" : "Supprimer l’article"}><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {!loading && articles.length > 0 && (
        <AdminPagination {...articlePagination} />
      )}
      <AdminConfirmDialog
        open={Boolean(deletingArticle)}
        onOpenChange={(open) => { if (!open) setDeletingArticle(null); }}
        title={en ? "Delete this article?" : "Supprimer cet article ?"}
        description={deletingArticle ? (en ? `“${deletingArticle.titleEn}” will be permanently removed.` : `« ${deletingArticle.titleFr} » sera définitivement supprimé.`) : ""}
        cancelLabel={en ? "Cancel" : "Annuler"}
        confirmLabel={en ? "Delete article" : "Supprimer l’article"}
        onConfirm={() => { if (deletingArticle) void remove(deletingArticle); }}
      />
    </div>
  );
}
