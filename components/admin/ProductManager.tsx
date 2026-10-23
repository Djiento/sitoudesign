
"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import ProductImageUploader from "@/components/admin/ProductImageUploader";
import { adminManagedImageUrl } from "@/lib/managed-image-url";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminLocalPagination } from "@/lib/use-admin-local-pagination";

type Locale = "fr" | "en";
type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type Category = {
  id: string;
  nameFr: string;
  nameEn: string;
  isActive?: boolean;
};

type ProductMedia = {
  id: string;
  url: string;
  altFr?: string | null;
  altEn?: string | null;
  fileName: string | null;
  type?: string;
};

type Product = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  shortDescriptionFr?: string | null;
  shortDescriptionEn?: string | null;
  categoryId: string;
  category?: Category | null;
  status: ProductStatus;
  featured: boolean;
  sortOrder: number;
  media?: ProductMedia[];
};

type ProductForm = {
  slug: string;
  nameFr: string;
  nameEn: string;
  shortDescriptionFr: string;
  shortDescriptionEn: string;
  descriptionFr: string;
  descriptionEn: string;
  categoryId: string;
  status: ProductStatus;
  featured: boolean;
  sortOrder: number;
};

const emptyForm: ProductForm = {
  slug: "",
  nameFr: "",
  nameEn: "",
  shortDescriptionFr: "",
  shortDescriptionEn: "",
  descriptionFr: "",
  descriptionEn: "",
  categoryId: "",
  status: "DRAFT",
  featured: false,
  sortOrder: 0,
};

export default function ProductManager({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const t = {
    title: en ? "Product management" : "Gestion des produits",
    subtitle: en
      ? "Manage your catalogue and product images."
      : "Gérez votre catalogue et les images de vos produits.",
    add: en ? "New product" : "Nouveau produit",
    search: en ? "Search products..." : "Rechercher un produit...",
    all: en ? "All statuses" : "Tous les statuts",
    draft: en ? "Draft" : "Brouillon",
    published: en ? "Published" : "Publié",
    archived: en ? "Archived" : "Archivé",
    nameFr: "Nom en français",
    nameEn: "Name in English",
    slug: "Slug (URL)",
    category: en ? "Category" : "Catégorie",
    chooseCategory: en ? "Choose a category" : "Choisir une catégorie",
    shortFr: "Description courte (FR)",
    shortEn: "Short description (EN)",
    descFr: "Description complète (FR)",
    descEn: "Full description (EN)",
    status: en ? "Status" : "Statut",
    featured: en ? "Featured product" : "Produit mis en avant",
    order: en ? "Display order" : "Ordre d’affichage",
    save: en ? "Save product" : "Enregistrer le produit",
    create: en ? "Create product" : "Créer le produit",
    cancel: en ? "Cancel" : "Annuler",
    edit: en ? "Edit" : "Modifier",
    delete: en ? "Delete" : "Supprimer",
    images: en ? "Product images" : "Images du produit",
    noProducts: en ? "No products found." : "Aucun produit trouvé.",
    noCategories: en
      ? "Create a category before adding a product."
      : "Créez une catégorie avant d’ajouter un produit.",
    loading: en ? "Loading products..." : "Chargement des produits...",
    confirmDelete: en
      ? "Delete this product? This action cannot be undone."
      : "Supprimer ce produit ? Cette action est irréversible.",
    createSuccess: en ? "Product created." : "Produit créé.",
    updateSuccess: en ? "Product updated." : "Produit modifié.",
    deleteSuccess: en ? "Product deleted." : "Produit supprimé.",
    retry: en ? "Retry" : "Réessayer",
    featuredYes: en ? "Featured" : "Mis en avant",
  };

  const statusLabel = (status: ProductStatus) => {
    if (status === "PUBLISHED") return t.published;
    if (status === "ARCHIVED") return t.archived;
    return t.draft;
  };

const loadData = useCallback(async () => {
  try {
    const [productsResponse, categoriesResponse] = await Promise.all([
      fetch("/api/admin/produits", { cache: "no-store" }),
      fetch("/api/admin/categories", { cache: "no-store" }),
    ]);

    const productsData = await productsResponse.json().catch(() => null);
    const categoriesData = await categoriesResponse.json().catch(() => null);

    if (!productsResponse.ok) {
      throw new Error(
        productsData?.error || "Impossible de charger les produits.",
      );
    }

    if (!categoriesResponse.ok) {
      throw new Error(
        categoriesData?.error || "Impossible de charger les catégories.",
      );
    }

    const productList = Array.isArray(productsData)
      ? productsData
      : productsData?.products;

    const categoryList = Array.isArray(categoriesData)
      ? categoriesData
      : categoriesData?.categories;

    if (!Array.isArray(productList) || !Array.isArray(categoryList)) {
      throw new Error(
        en
          ? "Unexpected API response. Check the GET responses for products and categories."
          : "Réponse API inattendue. Vérifiez les réponses GET des produits et des catégories.",
      );
    }

    setProducts(productList);
    setCategories(categoryList);
    setError("");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : en
          ? "An error occurred."
          : "Une erreur est survenue.",
    );
  } finally {
    setLoading(false);
  }
}, [en]);

useEffect(() => {
  let cancelled = false;

  const startLoading = async () => {
    await Promise.resolve();

    if (!cancelled) {
      await loadData();
    }
  };

  void startLoading();

  return () => {
    cancelled = true;
  };
}, [loadData]);


const refreshData = async () => {
  setLoading(true);
  setError("");
  await loadData();
};

  const startCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? "",
    });
    setError("");
    setNotice("");
    setShowForm(true);
  };

  const startEdit = (product: Product) => {
    setEditing(product);
    setForm({
      slug: product.slug ?? "",
      nameFr: product.nameFr ?? "",
      nameEn: product.nameEn ?? "",
      shortDescriptionFr: product.shortDescriptionFr ?? "",
      shortDescriptionEn: product.shortDescriptionEn ?? "",
      descriptionFr: product.descriptionFr ?? "",
      descriptionEn: product.descriptionEn ?? "",
      categoryId: product.categoryId ?? product.category?.id ?? "",
      status: product.status ?? "DRAFT",
      featured: Boolean(product.featured),
      sortOrder: Number(product.sortOrder ?? 0),
    });
    setError("");
    setNotice("");
    setShowForm(true);
  };

  const updateField = <K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const endpoint = editing
        ? `/api/admin/produits/${editing.id}`
        : "/api/admin/produits";

      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (en ? "Unable to save the product." : "Impossible d’enregistrer le produit."),
        );
      }

      const savedProduct = data?.product ?? data;

      if (savedProduct?.id) {
        setProducts((current) =>
          editing
            ? current.map((item) =>
                item.id === editing.id ? { ...item, ...savedProduct } : item,
              )
            : [savedProduct, ...current],
        );
      } else {
        await loadData();
      }

      setNotice(editing ? t.updateSuccess : t.createSuccess);

      if (!editing && savedProduct?.id) {
        setEditing(savedProduct as Product);
        setForm({
          ...form,
          categoryId: savedProduct.categoryId ?? form.categoryId,
        });
      } else if (!editing) {
        setShowForm(false);
      }

      if (editing) {
        setShowForm(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : en
            ? "An error occurred."
            : "Une erreur est survenue.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/produits/${product.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || (en ? "Unable to delete the product." : "Impossible de supprimer le produit."),
        );
      }

      setProducts((current) => current.filter((item) => item.id !== product.id));
      setDeletingProduct(null);

      if (editing?.id === product.id) {
        setEditing(null);
        setShowForm(false);
      }

      setNotice(t.deleteSuccess);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : en
            ? "An error occurred."
            : "Une erreur est survenue.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      product.nameFr?.toLowerCase().includes(term) ||
      product.nameEn?.toLowerCase().includes(term) ||
      product.slug?.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === "ALL" || product.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
  const { pageItems: pageProducts, paginationProps: productPagination, resetPage } =
    useAdminLocalPagination(filteredProducts);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-base-content/65">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={categories.length === 0}
          className="btn btn-primary"
        >
          <Plus size={18} />
          {t.add}
        </button>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
          <button type="button" className="btn btn-sm" onClick={() => void refreshData()}>
            {t.retry}
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="alert alert-success">
          <span>{notice}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setNotice("")}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {categories.length === 0 && !loading && (
        <div className="alert alert-warning">
          <span>{t.noCategories}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4 sm:flex-row">
        <label className="input input-bordered flex flex-1 items-center gap-2">
          <Search size={18} className="opacity-60" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder={t.search}
            className="grow"
          />
        </label>

        <select
          className="select select-bordered w-full sm:w-52"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            resetPage();
          }}
          aria-label={t.status}
        >
          <option value="ALL">{t.all}</option>
          <option value="DRAFT">{t.draft}</option>
          <option value="PUBLISHED">{t.published}</option>
          <option value="ARCHIVED">{t.archived}</option>
        </select>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void loadData()}
          disabled={loading}
          aria-label={t.retry}
        >
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
        </button>
      </div>

      {showForm && (
        <AdminDialog
          open={showForm}
          onOpenChange={(open) => {
            setShowForm(open);
            if (!open) {
              setEditing(null);
              setError("");
            }
          }}
          title={editing ? t.edit : t.create}
          description={editing ? t.edit : t.create}
          closeLabel={t.cancel}
        >
        <section className="admin-dialog-form">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {editing ? t.edit : t.create}
            </h2>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-2">{t.nameFr} *</span>
                <input
                  className="input input-bordered w-full"
                  value={form.nameFr}
                  onChange={(event) => updateField("nameFr", event.target.value)}
                  required
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.nameEn} *</span>
                <input
                  className="input input-bordered w-full"
                  value={form.nameEn}
                  onChange={(event) => updateField("nameEn", event.target.value)}
                  required
                />
              </label>

              <label className="form-control md:col-span-2">
                <span className="label-text mb-2">{t.slug} *</span>
                <input
                  className="input input-bordered w-full"
                  value={form.slug}
                  onChange={(event) =>
                    updateField(
                      "slug",
                      event.target.value
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, ""),
                    )
                  }
                  placeholder="exemple-produit"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.category} *</span>
                <select
                  className="select select-bordered w-full"
                  value={form.categoryId}
                  onChange={(event) => updateField("categoryId", event.target.value)}
                  required
                >
                  <option value="">{t.chooseCategory}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {en ? category.nameEn : category.nameFr}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.status}</span>
                <select
                  className="select select-bordered w-full"
                  value={form.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as ProductStatus)
                  }
                >
                  <option value="DRAFT">{t.draft}</option>
                  <option value="PUBLISHED">{t.published}</option>
                  <option value="ARCHIVED">{t.archived}</option>
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.shortFr}</span>
                <textarea
                  className="textarea textarea-bordered min-h-24"
                  value={form.shortDescriptionFr}
                  onChange={(event) =>
                    updateField("shortDescriptionFr", event.target.value)
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.shortEn}</span>
                <textarea
                  className="textarea textarea-bordered min-h-24"
                  value={form.shortDescriptionEn}
                  onChange={(event) =>
                    updateField("shortDescriptionEn", event.target.value)
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.descFr}</span>
                <textarea
                  className="textarea textarea-bordered min-h-36"
                  value={form.descriptionFr}
                  onChange={(event) => updateField("descriptionFr", event.target.value)}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.descEn}</span>
                <textarea
                  className="textarea textarea-bordered min-h-36"
                  value={form.descriptionEn}
                  onChange={(event) => updateField("descriptionEn", event.target.value)}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">{t.order}</span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    updateField("sortOrder", Number(event.target.value))
                  }
                />
              </label>

              <label className="label cursor-pointer justify-start gap-3 self-end">
                <input
                  className="checkbox checkbox-primary"
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => updateField("featured", event.target.checked)}
                />
                <span className="label-text">{t.featured}</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {t.save}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                  setError("");
                }}
                disabled={saving}
              >
                {t.cancel}
              </button>
            </div>
          </form>

          {editing && (
            <div className="mt-8 border-t border-base-300 pt-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <ImagePlus size={20} />
                {t.images}
              </h3>
              <ProductImageUploader
                key={editing.id}
                productId={editing.id}
                initialMedia={editing.media ?? []}
              />
            </div>
          )}
        </section>
        </AdminDialog>
      )}

      <section className="overflow-hidden rounded-box border border-base-300 bg-base-100">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-12">
            <LoaderCircle className="animate-spin" />
            <span>{t.loading}</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="p-10 text-center text-base-content/60">{t.noProducts}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>{en ? "Actions" : "Actions"}</th>
                  <th>{en ? "Product" : "Produit"}</th>
                  <th>{t.category}</th>
                  <th>{t.status}</th>
                  <th>{en ? "Order" : "Ordre"}</th>
                </tr>
              </thead>
              <tbody>
                {pageProducts.map((product) => {
                  const image = product.media?.[0]?.url;
                  const category = categories.find(
                    (item) => item.id === product.categoryId,
                  ) ?? product.category;

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="flex justify-start gap-2">
                          <button
                            type="button"
                            className="category-action-button category-edit-button"
                            onClick={() => startEdit(product)}
                            aria-label={`${t.edit}: ${product.nameFr}`}
                            title={t.edit}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="category-action-button category-delete-button"
                            onClick={() => setDeletingProduct(product)}
                            aria-label={`${t.delete}: ${product.nameFr}`}
                            title={t.delete}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={adminManagedImageUrl(image) ?? undefined}
                              alt={en ? product.nameEn : product.nameFr}
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-base-200">
                              <ImagePlus size={20} className="opacity-50" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold">
                              {en ? product.nameEn : product.nameFr}
                            </div>
                            <div className="text-xs text-base-content/60">
                              /{product.slug}
                            </div>
                            {product.featured && (
                              <span className="badge badge-secondary badge-sm mt-1">
                                {t.featuredYes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {category
                          ? en
                            ? category.nameEn
                            : category.nameFr
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            product.status === "PUBLISHED"
                              ? "badge-success"
                              : product.status === "ARCHIVED"
                                ? "badge-ghost"
                                : "badge-warning"
                          }`}
                        >
                          {statusLabel(product.status)}
                        </span>
                      </td>
                      <td>{product.sortOrder ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!loading && filteredProducts.length > 0 && (
        <AdminPagination {...productPagination} />
      )}
      <AdminConfirmDialog
        open={Boolean(deletingProduct)}
        onOpenChange={(open) => { if (!open) setDeletingProduct(null); }}
        title={t.delete}
        description={deletingProduct ? `${t.confirmDelete} ${deletingProduct.nameFr}` : ""}
        cancelLabel={t.cancel}
        confirmLabel={t.delete}
        busy={saving}
        onConfirm={() => { if (deletingProduct) void handleDelete(deletingProduct); }}
      />
    </div>
  );
}
