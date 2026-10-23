"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Plus,
  ImagePlus,
  Search,
  Pencil,
  Trash2,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminLocalPagination } from "@/lib/use-admin-local-pagination";
import { adminManagedImageUrl } from "@/lib/managed-image-url";

type Category = {
  id: string;
  nameFr: string;
  nameEn: string;
  slug: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  coverImage: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
};

type CategoryForm = {
  nameFr: string;
  nameEn: string;
  slug: string;
  descriptionFr: string;
  descriptionEn: string;
  coverImage: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyForm: CategoryForm = {
  nameFr: "",
  nameEn: "",
  slug: "",
  descriptionFr: "",
  descriptionEn: "",
  coverImage: "",
  sortOrder: 0,
  isActive: true,
};

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCoverImage, setRemoveCoverImage] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Chargement impossible.");
      }

      setCategories(data.categories ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de charger les catégories.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // The initial list is fetched from the protected admin API.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const refreshCategories = () => {
    setLoading(true);
    void loadCategories();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCoverImage(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({
      nameFr: category.nameFr,
      nameEn: category.nameEn,
      slug: category.slug,
      descriptionFr: category.descriptionFr ?? "",
      descriptionEn: category.descriptionEn ?? "",
      coverImage: category.coverImage ?? "",
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCoverImage(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
    setFormOpen(true);
  };

  const selectCoverImage = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      toast.error("Formats acceptés : JPEG, PNG, WebP et AVIF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("L’image ne doit pas dépasser 8 Mo.");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCoverImage(false);
  };

  const updateField = <K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleNameFrChange = (value: string) => {
    setForm((current) => ({
      ...current,
      nameFr: value,
      slug: editingId && current.slug ? current.slug : makeSlug(value),
    }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.nameFr.trim() || !form.nameEn.trim() || !form.slug.trim()) {
      toast.error("Les noms français, anglais et le slug sont obligatoires.");
      return;
    }

    setSaving(true);
    let savedCategoryId = editingId;
    let categorySaved = false;

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/categories/${editingId}`
          : "/api/admin/categories",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            nameFr: form.nameFr.trim(),
            nameEn: form.nameEn.trim(),
            slug: makeSlug(form.slug),
            descriptionFr: form.descriptionFr.trim() || null,
            descriptionEn: form.descriptionEn.trim() || null,
            coverImage: editingId ? undefined : null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Enregistrement impossible.");
      }

      if (typeof data.category?.id !== "string") {
        throw new Error("La réponse de la catégorie est invalide.");
      }
      savedCategoryId = data.category.id;
      categorySaved = true;

      let warning: string | undefined;
      if (coverFile) {
        const uploadData = new FormData();
        uploadData.append("file", coverFile);
        const uploadResponse = await fetch(
          `/api/admin/categories/${savedCategoryId}/cover`,
          { method: "POST", body: uploadData },
        );
        const uploaded = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(
            `La catégorie est enregistrée, mais l’image n’a pas pu être téléversée : ${uploaded.error || "erreur inconnue."}`,
          );
        }
        warning = uploaded.cleanupWarning;
      } else if (removeCoverImage && editingId) {
        const removeResponse = await fetch(
          `/api/admin/categories/${editingId}/cover`,
          { method: "DELETE" },
        );
        const removed = await removeResponse.json();
        if (!removeResponse.ok) {
          throw new Error(
            `La catégorie est enregistrée, mais l’image n’a pas pu être retirée : ${removed.error || "erreur inconnue."}`,
          );
        }
        warning = removed.warning;
      }

      toast.success(editingId ? "Catégorie modifiée avec succès." : "Catégorie créée avec succès.");
      if (warning) toast.warning(warning);
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setCoverFile(null);
      setCoverPreview(null);
      setRemoveCoverImage(false);
      if (coverInputRef.current) coverInputRef.current.value = "";

      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
      if (categorySaved) {
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        setCoverFile(null);
        setCoverPreview(null);
        setRemoveCoverImage(false);
        if (coverInputRef.current) coverInputRef.current.value = "";
        await loadCategories();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (category._count.products > 0) {
      toast.error(
        `Cette catégorie contient ${category._count.products} produit(s). Réaffecte-les avant de la supprimer.`,
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/categories/${category.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Suppression impossible.");
      }

      toast.success("Catégorie supprimée.");
      setDeletingCategory(null);
      if (data.warning) toast.warning(data.warning);
      await loadCategories();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = categories.filter((category) => {
    const query = search.toLowerCase().trim();

    return (
      category.nameFr.toLowerCase().includes(query) ||
      category.nameEn.toLowerCase().includes(query) ||
      category.slug.toLowerCase().includes(query)
    );
  });
  const {
    pageItems: visibleCategories,
    paginationProps: visibleCategoryPagination,
    resetPage,
  } = useAdminLocalPagination(filteredCategories);

  const activeCount = categories.filter((category) => category.isActive).length;
  const productCount = categories.reduce(
    (total, category) => total + category._count.products,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Catégories
          </h1>
          <p className="mt-1 text-sm text-base-content/60">
            Organisez les catégories du catalogue Sitou Design. Modifiez-les à tout moment ; la suppression est disponible lorsqu’aucun produit n’y est associé.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="btn btn-primary gap-2"
        >
          <Plus size={18} />
          Nouvelle catégorie
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <div className="stat-figure text-primary">
            <FolderOpen size={25} />
          </div>
          <div className="stat-title">Total catégories</div>
          <div className="stat-value text-3xl">{categories.length}</div>
        </div>

        <div className="stat rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <div className="stat-figure text-success">
            <CheckCircle2 size={25} />
          </div>
          <div className="stat-title">Catégories actives</div>
          <div className="stat-value text-3xl">{activeCount}</div>
        </div>

        <div className="stat rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <div className="stat-figure text-secondary">
            <Package size={25} />
          </div>
          <div className="stat-title">Produits associés</div>
          <div className="stat-value text-3xl">{productCount}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="input input-bordered flex flex-1 items-center gap-2">
          <Search size={18} className="opacity-50" />
          <input
            type="search"
            className="grow"
            placeholder="Rechercher par nom ou slug..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
        </label>

        <button
          type="button"
          className="btn btn-outline"
          onClick={refreshCategories}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {formOpen && (
        <AdminDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) {
              setCoverFile(null);
              setCoverPreview(null);
              if (coverInputRef.current) coverInputRef.current.value = "";
            }
          }}
          title={editingId ? "Modifier la catégorie" : "Créer une catégorie"}
          description="Les catégories sont enregistrées dans le catalogue et peuvent être associées aux produits."
          closeLabel="Fermer le formulaire"
          className="admin-category-dialog"
        >
          <form onSubmit={handleSave} className="admin-category-form space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-2 font-medium">
                  Nom français *
                </span>
                <input
                  className="input input-bordered w-full"
                  value={form.nameFr}
                  onChange={(event) => handleNameFrChange(event.target.value)}
                  placeholder="Ex. Enseignes et signalétiques"
                  required
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">
                  Nom anglais *
                </span>
                <input
                  className="input input-bordered w-full"
                  value={form.nameEn}
                  onChange={(event) =>
                    updateField("nameEn", event.target.value)
                  }
                  placeholder="Ex. Signs and signage"
                  required
                />
              </label>

              <label className="form-control md:col-span-2">
                <span className="label-text mb-2 font-medium">Slug *</span>
                <input
                  className="input input-bordered w-full"
                  value={form.slug}
                  onChange={(event) =>
                    updateField("slug", makeSlug(event.target.value))
                  }
                  placeholder="enseignes-signaletiques"
                  required
                />
                <span className="label-text-alt mt-1 text-base-content/50">
                  Identifiant utilisé dans les URL.
                </span>
              </label>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">
                  Description française
                </span>
                <textarea
                  className="textarea textarea-bordered min-h-28"
                  value={form.descriptionFr}
                  onChange={(event) =>
                    updateField("descriptionFr", event.target.value)
                  }
                  placeholder="Description de la catégorie..."
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">
                  Description anglaise
                </span>
                <textarea
                  className="textarea textarea-bordered min-h-28"
                  value={form.descriptionEn}
                  onChange={(event) =>
                    updateField("descriptionEn", event.target.value)
                  }
                  placeholder="Category description..."
                />
              </label>

              <div className="form-control md:col-span-2">
                <span className="label-text mb-2 font-medium">Image de couverture</span>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  onChange={(event) => selectCoverImage(event.target.files?.[0])}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-outline gap-2"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={saving}
                  >
                    <ImagePlus size={17} />
                    {coverFile ? "Changer l’image" : "Téléverser une image"}
                  </button>
                  <span className="text-xs text-base-content/60">
                    JPEG, PNG, WebP ou AVIF · 8 Mo maximum
                  </span>
                </div>
                {(coverPreview || form.coverImage) && !removeCoverImage ? (
                  <div className="mt-3 flex flex-wrap items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverPreview ?? adminManagedImageUrl(form.coverImage) ?? undefined}
                      alt="Aperçu de la couverture"
                      className="h-36 w-full rounded-xl border border-base-300 object-cover sm:w-64"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm gap-2 text-error"
                      disabled={saving}
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview(null);
                        setRemoveCoverImage(Boolean(form.coverImage));
                        if (coverInputRef.current) coverInputRef.current.value = "";
                      }}
                    >
                      <Trash2 size={15} />
                      Retirer l’image
                    </button>
                  </div>
                ) : removeCoverImage ? (
                  <p className="mt-3 text-sm text-base-content/60">
                    L’image sera supprimée lors de l’enregistrement.
                  </p>
                ) : null}
              </div>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">
                  Ordre d’affichage
                </span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    updateField("sortOrder", Number(event.target.value))
                  }
                />
              </label>

              <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-base-300 p-4">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={form.isActive}
                  onChange={(event) =>
                    updateField("isActive", event.target.checked)
                  }
                />
                <span>
                  <span className="block font-medium">Catégorie active</span>
                  <span className="text-xs text-base-content/60">
                    Visible selon les règles du catalogue.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-base-300 pt-5">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                {saving
                  ? "Enregistrement..."
                  : editingId
                    ? "Enregistrer les modifications"
                    : "Créer la catégorie"}
              </button>
            </div>
          </form>
        </AdminDialog>
      )}

      <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <FolderOpen size={42} className="mb-3 opacity-30" />
            <h3 className="font-semibold">Aucune catégorie trouvée</h3>
            <p className="mt-1 text-sm text-base-content/60">
              {search
                ? "Essaie une autre recherche."
                : "Crée ta première catégorie pour commencer."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Slug</th>
                  <th>Produits</th>
                  <th>Ordre</th>
                  <th>Statut</th>
                  <th className="category-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCategories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {category.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={adminManagedImageUrl(category.coverImage) ?? undefined}
                            alt=""
                            className="h-12 w-12 rounded-lg border border-base-300 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-base-200">
                            <FolderOpen size={20} className="opacity-50" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{category.nameFr}</div>
                          <div className="text-xs text-base-content/60">
                            {category.nameEn}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="text-xs">{category.slug}</code>
                    </td>
                    <td>
                      <span className="badge badge-outline">
                        {category._count.products}
                      </span>
                    </td>
                    <td>{category.sortOrder}</td>
                    <td>
                      <span
                        className={`badge ${
                          category.isActive
                            ? "badge-success"
                            : "badge-ghost"
                        }`}
                      >
                        {category.isActive ? (
                          <CheckCircle2 size={12} className="mr-1" />
                        ) : (
                          <XCircle size={12} className="mr-1" />
                        )}
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="category-actions-cell">
                      <div className="category-actions">
                        <div className="category-actions-buttons">
                          <button
                            type="button"
                            className="category-action-button category-edit-button"
                            onClick={() => openEdit(category)}
                            aria-label={`Modifier ${category.nameFr}`}
                            title="Modifier"
                          >
                            <Pencil size={16} />
                            <span>Modifier</span>
                          </button>
                          <button
                            type="button"
                            className="category-action-button category-delete-button"
                            onClick={() => {
                              if (category._count.products > 0) void handleDelete(category);
                              else setDeletingCategory(category);
                            }}
                            disabled={category._count.products > 0}
                            aria-label={`Supprimer ${category.nameFr}`}
                            title={category._count.products > 0
                              ? `Impossible de supprimer : ${category._count.products} produit(s) sont associés à cette catégorie.`
                              : "Supprimer cette catégorie"}
                          >
                            <Trash2 size={16} />
                            <span>Supprimer</span>
                          </button>
                        </div>
                        {category._count.products > 0 && (
                          <span className="category-delete-hint">
                            {category._count.products} produit(s) associé(s)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && filteredCategories.length > 0 && (
        <AdminPagination {...visibleCategoryPagination} />
      )}
      <AdminConfirmDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(open) => { if (!open) setDeletingCategory(null); }}
        title="Supprimer cette catégorie ?"
        description={deletingCategory ? `« ${deletingCategory.nameFr} » sera définitivement supprimée. Cette action est irréversible.` : ""}
        cancelLabel="Annuler"
        confirmLabel="Supprimer la catégorie"
        busy={saving}
        onConfirm={() => { if (deletingCategory) void handleDelete(deletingCategory); }}
      />
    </div>
  );
}