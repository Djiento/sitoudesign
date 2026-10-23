"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminLocalPagination } from "@/lib/use-admin-local-pagination";
import { adminManagedImageUrl } from "@/lib/managed-image-url";

type GalleryImage = {
  id: string;
  url: string;
  fileName: string | null;
  altFr: string | null;
  altEn: string | null;
  sortOrder: number;
};

type Project = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  clientName: string | null;
  category: string | null;
  coverImage: string | null;
  isPublished: boolean;
  featured: boolean;
  projectDate: string | null;
  sortOrder: number;
  gallery: GalleryImage[];
};

function isGalleryImage(value: unknown): value is GalleryImage {
  if (typeof value !== "object" || value === null) return false;
  const image = value as Record<string, unknown>;

  return (
    typeof image.id === "string" &&
    typeof image.url === "string" &&
    (typeof image.fileName === "string" || image.fileName === null) &&
    (typeof image.altFr === "string" || image.altFr === null) &&
    (typeof image.altEn === "string" || image.altEn === null) &&
    typeof image.sortOrder === "number"
  );
}

function isProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Record<string, unknown>;

  return (
    typeof project.id === "string" &&
    typeof project.slug === "string" &&
    typeof project.titleFr === "string" &&
    typeof project.titleEn === "string" &&
    typeof project.descriptionFr === "string" &&
    typeof project.descriptionEn === "string" &&
    (typeof project.clientName === "string" || project.clientName === null) &&
    (typeof project.category === "string" || project.category === null) &&
    (typeof project.coverImage === "string" || project.coverImage === null) &&
    typeof project.isPublished === "boolean" &&
    typeof project.featured === "boolean" &&
    (typeof project.projectDate === "string" || project.projectDate === null) &&
    typeof project.sortOrder === "number" &&
    Array.isArray(project.gallery) &&
    project.gallery.every(isGalleryImage)
  );
}

type ProjectForm = {
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  clientName: string;
  category: string;
  coverImage: string;
  projectDate: string;
  sortOrder: number;
  featured: boolean;
  isPublished: boolean;
};

const EMPTY_FORM: ProjectForm = {
  slug: "",
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  clientName: "",
  category: "",
  coverImage: "",
  projectDate: "",
  sortOrder: 0,
  featured: false,
  isPublished: false,
};

type Props = {
  locale: "fr" | "en";
};

async function readApiPayload(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

    throw new Error(
      response.ok
        ? "Réponse invalide du serveur."
        : `Le serveur n'a pas renvoyé de détail (HTTP ${response.status}).`,
    );
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Réponse invalide du serveur.");
  }

  return payload as Record<string, unknown>;
}

export default function PortfolioManager({ locale }: Props) {
  const en = locale === "en";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const t = {
    title: en ? "Portfolio projects" : "Réalisations",
    subtitle: en
      ? "Manage your portfolio and published projects."
      : "Gérez votre portfolio et les projets publiés.",
    add: en ? "New project" : "Nouvelle réalisation",
    search: en ? "Search projects..." : "Rechercher une réalisation...",
    loading: en ? "Loading projects..." : "Chargement des réalisations...",
    empty: en ? "No projects found." : "Aucune réalisation trouvée.",
    edit: en ? "Edit" : "Modifier",
    remove: en ? "Delete" : "Supprimer",
    published: en ? "Published" : "Publié",
    draft: en ? "Draft" : "Brouillon",
    featured: en ? "Featured" : "Mis en avant",
    titleFr: "Titre en français",
    titleEn: "Title in English",
    descriptionFr: "Description en français",
    descriptionEn: "Description in English",
    slug: "Slug",
    client: en ? "Client" : "Client",
    category: en ? "Category" : "Catégorie",
    cover: en ? "Cover image URL" : "URL de l’image de couverture",
    date: en ? "Project date" : "Date du projet",
    order: en ? "Display order" : "Ordre d’affichage",
    gallery: en ? "Project gallery" : "Galerie du projet",
    upload: en ? "Upload images" : "Envoyer les images",
    choose: en ? "Choose images" : "Choisir des images",
    publish: en ? "Publish project" : "Publier la réalisation",
    feature: en ? "Feature this project" : "Mettre en avant",
    save: en ? "Save project" : "Enregistrer la réalisation",
    create: en ? "Create project" : "Créer la réalisation",
    cancel: en ? "Cancel" : "Annuler",
    saving: en ? "Saving..." : "Enregistrement...",
    uploading: en ? "Uploading..." : "Envoi en cours...",
    confirmDelete: en
      ? "Delete this project permanently?"
      : "Supprimer définitivement cette réalisation ?",
    deleteSuccess: en
      ? "Project deleted."
      : "Réalisation supprimée.",
    saveSuccess: en
      ? "Project saved."
      : "Réalisation enregistrée.",
    publishedSaveSuccess: en
      ? "Project saved and published on the website."
      : "Réalisation enregistrée et publiée sur le site.",
    draftSaveSuccess: en
      ? "Project saved as a draft. Publish it to show it on the website."
      : "Réalisation enregistrée en brouillon. Publiez-la pour l’afficher sur le site.",
    uploadSuccess: en
      ? "Images uploaded."
      : "Images envoyées.",
    required: en
      ? "Please complete both titles and descriptions."
      : "Renseigne les deux titres et les deux descriptions.",
    imageHint: en
      ? "JPEG, PNG, WebP or AVIF — 8 MB maximum per image."
      : "JPEG, PNG, WebP ou AVIF — 8 Mo maximum par image.",
    noGallery: en
      ? "No gallery images yet."
      : "Aucune image dans la galerie.",
  };

  const loadProjects = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/admin/realisations", {
        cache: "no-store",
      });
      const payload = await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Impossible de charger les projets.",
        );
      }

      if (
        !Array.isArray(payload.projects) ||
        !payload.projects.every(isProject)
      ) {
        throw new Error("Le serveur a renvoyé une liste de réalisations invalide.");
      }

      setProjects(payload.projects);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de charger les réalisations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      await Promise.resolve();
      if (!cancelled) {
        await loadProjects();
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, [loadProjects]);

  const refresh = async () => {
    setLoading(true);
    await loadProjects();
  };

  const setField = <K extends keyof ProjectForm>(
    key: K,
    value: ProjectForm[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedFiles([]);
    setError("");
    setNotice("");
    setFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setForm({
      slug: project.slug,
      titleFr: project.titleFr,
      titleEn: project.titleEn,
      descriptionFr: project.descriptionFr,
      descriptionEn: project.descriptionEn,
      clientName: project.clientName ?? "",
      category: project.category ?? "",
      coverImage: project.coverImage ?? "",
      projectDate: project.projectDate
        ? project.projectDate.slice(0, 10)
        : "",
      sortOrder: project.sortOrder,
      featured: project.featured,
      isPublished: project.isPublished,
    });
    setSelectedFiles([]);
    setError("");
    setNotice("");
    setFormOpen(true);
  };


  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const uploadImages = async (projectId: string, files: File[]) => {
    for (const file of files) {
      const data = new FormData();
      data.append("file", file);

      const response = await fetch(
        `/api/admin/realisations/${projectId}/media`,
        {
          method: "POST",
          body: data,
        },
      );

      const payload = await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : `Échec de l'envoi de ${file.name}.`,
        );
      }

      setSelectedFiles((current) => current.filter((selected) => selected !== file));
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (
      !form.titleFr.trim() ||
      !form.titleEn.trim() ||
      !form.descriptionFr.trim() ||
      !form.descriptionEn.trim()
    ) {
      setError(t.required);
      return;
    }

    setSaving(true);
    let savedProject: Project | null = null;

    try {
      const payload = {
        ...form,
        projectDate: form.projectDate || null,
        clientName: form.clientName.trim() || null,
        category: form.category.trim() || null,
        coverImage: form.coverImage.trim() || null,
      };

      const response = await fetch(
        editing
          ? `/api/admin/realisations/${editing.id}`
          : "/api/admin/realisations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Échec de l'enregistrement.",
        );
      }

      if (!isProject(result.project)) {
        throw new Error("Le serveur n'a pas confirmé l'enregistrement du projet.");
      }

      savedProject = result.project;

      if (selectedFiles.length > 0) {
        setUploading(true);
        setEditing(savedProject);
        await uploadImages(savedProject.id, selectedFiles);
      }

      setNotice(
        form.isPublished ? t.publishedSaveSuccess : t.draftSaveSuccess,
      );
      setEditing(null);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setSelectedFiles([]);
      await loadProjects();
    } catch (cause) {
      if (savedProject) {
        setEditing(savedProject);
        setFormOpen(true);
        await loadProjects();
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Une erreur est survenue.",
      );
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const deleteProject = async (project: Project) => {
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const response = await fetch(
        `/api/admin/realisations/${project.id}`,
        { method: "DELETE" },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Échec de la suppression.");
      }

      if (editing?.id === project.id) {
        setEditing(null);
        setForm(EMPTY_FORM);
      }

      setNotice(t.deleteSuccess);
      setDeletingProject(null);
      await loadProjects();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Échec de la suppression.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const query = search.toLowerCase();

    return [
      project.titleFr,
      project.titleEn,
      project.slug,
      project.clientName ?? "",
      project.category ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
  const {
    pageItems: pageProjects,
    paginationProps: projectPagination,
    resetPage,
  } = useAdminLocalPagination(filteredProjects);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-base-content/65">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {en ? "Refresh" : "Actualiser"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Plus size={18} />
            {t.add}
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setError("")}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="alert alert-success">
          <Check size={18} />
          <span>{notice}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setNotice("")}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="stats stats-vertical shadow sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title">{en ? "Total projects" : "Total"}</div>
          <div className="stat-value">{projects.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">{t.published}</div>
          <div className="stat-value text-success">
            {projects.filter((project) => project.isPublished).length}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">{t.draft}</div>
          <div className="stat-value">
            {projects.filter((project) => !project.isPublished).length}
          </div>
        </div>
      </div>

      <label className="input input-bordered flex w-full items-center gap-2">
        <Search size={18} className="opacity-60" />
        <input
          type="search"
          className="grow"
          placeholder={t.search}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
        />
      </label>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16">
          <LoaderCircle className="animate-spin" />
          <span>{t.loading}</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <ImagePlus className="mx-auto mb-3 opacity-50" size={36} />
          <p>{t.empty}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {pageProjects.map((project) => (
            <article
              key={project.id}
              className="card overflow-hidden border border-base-300 bg-base-100 shadow-sm"
            >
              <figure className="relative aspect-[16/10] bg-base-200">
                {project.gallery[0]?.url || project.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      project.gallery[0]
                        ? `/api/portfolio/media/${project.gallery[0].id}`
                        : adminManagedImageUrl(project.coverImage) || ""
                    }
                    alt={project.titleFr}
                    className="h-full w-full bg-base-200 p-2 object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImagePlus size={40} className="opacity-30" />
                  </div>
                )}

                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <span
                    className={`badge ${
                      project.isPublished ? "badge-success" : "badge-ghost"
                    }`}
                  >
                    {project.isPublished ? t.published : t.draft}
                  </span>
                  {project.featured && (
                    <span className="badge badge-warning gap-1">
                      <Star size={12} />
                      {t.featured}
                    </span>
                  )}
                </div>
              </figure>

              <div className="card-body gap-3">
                <div>
                  <h2 className="card-title">{project.titleFr}</h2>
                  <p className="text-sm text-base-content/60">
                    {project.titleEn}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {project.category && (
                    <span className="badge badge-outline">
                      {project.category}
                    </span>
                  )}
                  {project.clientName && (
                    <span className="badge badge-ghost">
                      {project.clientName}
                    </span>
                  )}
                  <span className="badge badge-ghost">
                    {project.gallery.length} {en ? "images" : "images"}
                  </span>
                </div>

                <p className="line-clamp-3 text-sm text-base-content/70">
                  {project.descriptionFr}
                </p>

                <div className="card-actions mt-2 justify-end">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => openEdit(project)}
                  >
                    <Pencil size={15} />
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    className="btn btn-error btn-outline btn-sm"
                    onClick={() => setDeletingProject(project)}
                  >
                    <Trash2 size={15} />
                    {t.remove}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && filteredProjects.length > 0 && (
        <AdminPagination {...projectPagination} />
      )}

      {(editing || form.titleFr === "" && form.titleEn === "" && notice === "" && false) && null}

      {editing && (
        <AdminDialog
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              setForm(EMPTY_FORM);
              setSelectedFiles([]);
            }
          }}
          title={en ? "Edit project" : "Modifier la réalisation"}
          description={en ? "Update project details and its published media." : "Modifiez les informations et les visuels de cette réalisation."}
          closeLabel={t.cancel}
          className="admin-portfolio-dialog"
        >
        <div className="admin-portfolio-dialog-body rounded-2xl border border-primary/30 bg-base-100 p-5 shadow-sm sm:p-7">
          <form className="admin-portfolio-dialog-form space-y-5" onSubmit={handleSave}>
            <ProjectFields
              form={form}
              setField={setField}
              labels={t}
              onFiles={handleFiles}
              selectedFiles={selectedFiles}
              project={editing}
              en={en}
            />

            <div className="admin-portfolio-dialog-actions flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY_FORM);
                  setSelectedFiles([]);
                }}
              >
                {t.cancel}
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving || uploading ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Check size={17} />
                )}
                {saving ? t.saving : t.save}
              </button>
            </div>
          </form>
        </div>
        </AdminDialog>
      )}

      {formOpen && !editing && (
        <AdminDialog
          open={formOpen && !editing}
          onOpenChange={(open) => {
            if (!open) {
              setFormOpen(false);
              setForm(EMPTY_FORM);
              setSelectedFiles([]);
            }
          }}
          title={t.add}
          description={en ? "Add a new portfolio item and upload its images." : "Ajoutez une réalisation et téléversez ses images."}
          closeLabel={t.cancel}
          className="admin-portfolio-dialog"
        >
        <div className="admin-portfolio-dialog-body rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
          <form className="admin-portfolio-dialog-form space-y-5" onSubmit={handleSave}>
            <ProjectFields
              form={form}
              setField={setField}
              labels={t}
              onFiles={handleFiles}
              selectedFiles={selectedFiles}
              project={null}
              en={en}
            />

            <div className="admin-portfolio-dialog-actions flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving || uploading ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Plus size={17} />
                )}
                {saving ? t.saving : t.create}
              </button>
            </div>
          </form>
        </div>
        </AdminDialog>
      )}
      <AdminConfirmDialog
        open={Boolean(deletingProject)}
        onOpenChange={(open) => { if (!open) setDeletingProject(null); }}
        title={en ? "Delete this project?" : "Supprimer cette réalisation ?"}
        description={deletingProject ? `${t.confirmDelete} ${en ? deletingProject.titleEn : deletingProject.titleFr}` : ""}
        cancelLabel={t.cancel}
        confirmLabel={en ? "Delete project" : "Supprimer la réalisation"}
        busy={saving}
        onConfirm={() => { if (deletingProject) void deleteProject(deletingProject); }}
      />
    </div>
  );
}

type ProjectFieldsProps = {
  form: ProjectForm;
  setField: <K extends keyof ProjectForm>(
    key: K,
    value: ProjectForm[K],
  ) => void;
  labels: Record<string, string>;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  selectedFiles: File[];
  project: Project | null;
  en: boolean;
};

function ProjectFields({
  form,
  setField,
  labels,
  onFiles,
  selectedFiles,
  project,
  en,
}: ProjectFieldsProps) {
  const fieldClass = "input input-bordered w-full";
  const areaClass = "textarea textarea-bordered min-h-32 w-full";
  const uploadedCover = project?.gallery.find(
    (image) => image.url === form.coverImage,
  );
  const coverPreview = uploadedCover
    ? `/api/portfolio/media/${uploadedCover.id}`
    : form.coverImage;

  return (
    <>
      <section className="admin-portfolio-form-section">
        <div className="admin-portfolio-form-section-heading">
          <span className="admin-eyebrow">{en ? "PROJECT DETAILS" : "DÉTAILS DU PROJET"}</span>
          <h3>{en ? "Project information" : "Informations du projet"}</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control gap-1">
          <span className="label-text font-medium">{labels.titleFr}</span>
          <input
            className={fieldClass}
            value={form.titleFr}
            required
            onChange={(e) => setField("titleFr", e.target.value)}
          />
        </label>

        <label className="form-control gap-1">
          <span className="label-text font-medium">{labels.titleEn}</span>
          <input
            className={fieldClass}
            value={form.titleEn}
            required
            onChange={(e) => setField("titleEn", e.target.value)}
          />
        </label>

        <label className="form-control gap-1 md:col-span-2">
          <span className="label-text font-medium">{labels.descriptionFr}</span>
          <textarea
            className={areaClass}
            value={form.descriptionFr}
            required
            onChange={(e) => setField("descriptionFr", e.target.value)}
          />
        </label>

        <label className="form-control gap-1 md:col-span-2">
          <span className="label-text font-medium">{labels.descriptionEn}</span>
          <textarea
            className={areaClass}
            value={form.descriptionEn}
            required
            onChange={(e) => setField("descriptionEn", e.target.value)}
          />
        </label>

        <label className="form-control gap-1">
          <span className="label-text font-medium">{labels.slug}</span>
          <input
            className={fieldClass}
            value={form.slug}
            placeholder={en ? "Leave blank to generate from French title" : "Vide = généré depuis le titre français"}
            onChange={(e) => setField("slug", e.target.value)}
          />
        </label>

        <label className="form-control gap-1">
          <span className="label-text font-medium">{labels.client}</span>
          <input
            className={fieldClass}
            value={form.clientName}
            onChange={(e) => setField("clientName", e.target.value)}
          />
        </label>

        <label className="form-control gap-1">
          <span className="label-text font-medium">{labels.category}</span>
          <input
            className={fieldClass}
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
          />
        </label>

        <label className="form-control gap-1">
          <span className="label-text font-medium">{labels.date}</span>
          <input
            className={fieldClass}
            type="date"
            value={form.projectDate}
            onChange={(e) => setField("projectDate", e.target.value)}
          />
        </label>

        <label className="form-control gap-1 md:col-span-2">
          <span className="label-text font-medium">{labels.cover}</span>
          <input
            className={fieldClass}
            type="url"
            placeholder="https://..."
            value={form.coverImage}
            onChange={(e) => setField("coverImage", e.target.value)}
          />
          {coverPreview && (
            <div className="mt-2 overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPreview}
                alt="Aperçu de couverture"
                className="max-h-64 w-full object-contain"
              />
            </div>
          )}
        </label>

        <label className="form-control gap-1">
          <span className="label-text font-medium">{labels.order}</span>
          <input
            className={fieldClass}
            type="number"
            value={form.sortOrder}
            onChange={(e) => setField("sortOrder", Number(e.target.value))}
          />
        </label>
        </div>
      </section>

      <section className="admin-portfolio-form-section admin-portfolio-publish-section">
        <div className="admin-portfolio-form-section-heading">
          <span className="admin-eyebrow">{en ? "VISIBILITY" : "VISIBILITÉ"}</span>
          <h3>{en ? "Publication settings" : "Paramètres de publication"}</h3>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl bg-base-200/60 p-4">
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-primary"
            checked={form.isPublished}
            onChange={(e) => setField("isPublished", e.target.checked)}
          />
          <span>{labels.publish}</span>
          {form.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
        </label>

        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-primary"
            checked={form.featured}
            onChange={(e) => setField("featured", e.target.checked)}
          />
          <span>{labels.feature}</span>
          <Star size={16} />
        </label>
        </div>
      </section>

      <section className="admin-portfolio-form-section space-y-3">
        <div className="admin-portfolio-form-section-heading">
          <span className="admin-eyebrow">{en ? "VISUALS" : "VISUELS"}</span>
          <h3>{labels.gallery}</h3>
        </div>

        {project && project.gallery.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {project.gallery.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/portfolio/media/${image.id}`}
                  alt={image.altFr ?? image.fileName ?? ""}
                  className="aspect-square w-full bg-base-200 object-contain p-2"
                />
                <p className="truncate p-2 text-xs">
                  {image.fileName ?? image.url}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-base-content/60">
            {labels.noGallery}
          </p>
        )}

        <label className="form-control gap-2">
          <span className="label-text">{labels.choose}</span>
          <input
            type="file"
            className="file-input file-input-bordered w-full"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={onFiles}
          />
        </label>

        <p className="text-xs text-base-content/60">
          {labels.imageHint}
        </p>

        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm">
              {selectedFiles.length} {en ? "file(s) selected" : "fichier(s) sélectionné(s)"}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {selectedFiles.map((file) => (
                <SelectedImagePreview file={file} key={`${file.name}-${file.lastModified}`} />
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function SelectedImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const frame = window.requestAnimationFrame(() => setPreviewUrl(url));

    return () => {
      window.cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="overflow-hidden rounded-lg border border-base-300">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="aspect-square w-full bg-base-200 object-contain p-2"
        />
      ) : (
        <div className="aspect-square animate-pulse bg-base-200" />
      )}
      <p className="truncate p-2 text-xs" title={file.name}>
        {file.name}
      </p>
    </div>
  );
}