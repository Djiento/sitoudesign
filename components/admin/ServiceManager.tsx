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

type Service = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  coverImage: string | null;
  unitPrice: number | null;
  billingUnit: string | null;
  salesCategory: string;
  serviceCategory: string | null;
  isActive: boolean;
  sortOrder: number;
};

type ServiceForm = Omit<Service, "id" | "coverImage" | "unitPrice" | "billingUnit"> & {
  coverImage: string;
  unitPrice: string;
  billingUnit: string;
};

const blankForm: ServiceForm = {
  slug: "",
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  coverImage: "",
  unitPrice: "",
  billingUnit: "prestation",
  salesCategory: "OTHER",
  serviceCategory: "impression-numerique",
  isActive: true,
  sortOrder: 0,
};

const serviceCategories = [
  ["impression-numerique", "Impression numérique", "Digital printing"],
  ["signaletique-enseignes", "Signalétique et enseignes", "Signage and signs"],
  ["textile-personnalise", "Impression textile et personnalisation", "Textile printing and customization"],
  ["objets-publicitaires", "Objets publicitaires et cadeaux", "Promotional products and gifts"],
  ["design-graphique", "Design graphique et communication visuelle", "Graphic design and visual communication"],
  ["packaging-emballages", "Packaging et emballages", "Packaging"],
  ["publicite-evenementiel", "Publicité et événementiel", "Advertising and events"],
  ["impression-grand-format", "Impression grand format", "Large-format printing"],
  ["solutions-numeriques-web", "Solutions numériques et web", "Digital and web solutions"],
  ["services-entreprises", "Services aux entreprises", "Business services"],
] as const;

function slugify(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ServiceManager({ locale }: { locale: Locale }) {
  const en = locale === "en";
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<ServiceForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { pageItems: pageServices, paginationProps: servicePagination } =
    useAdminLocalPagination(services);

  const loadServices = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/services", { cache: "no-store" });
      const data: { services?: Service[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not load services." : "Impossible de charger les services."));
      if (!Array.isArray(data.services)) throw new Error(en ? "The services response is invalid." : "La réponse des services est invalide.");
      setServices(data.services);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not load services." : "Impossible de charger les services."));
    } finally {
      setLoading(false);
    }
  }, [en]);

  // The initial list is fetched from the protected admin API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadServices(); }, [loadServices]);
  const refreshServices = () => {
    setLoading(true);
    void loadServices();
  };

  const openNew = () => {
    setEditingId(null);
    setForm(blankForm);
    setFormOpen(true);
  };

  const openEdit = (service: Service) => {
    const { id, ...values } = service;
    setEditingId(id);
    setForm({
      ...values,
      serviceCategory: values.serviceCategory ?? "services-entreprises",
      coverImage: values.coverImage ?? "",
      unitPrice: values.unitPrice?.toString() ?? "",
      billingUnit: values.billingUnit ?? "prestation",
    });
    setFormOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/admin/services/${editingId}` : "/api/admin/services",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            slug: slugify(form.slug),
            coverImage: form.coverImage.trim(),
            unitPrice: form.unitPrice.trim() ? Number(form.unitPrice) : null,
            billingUnit: form.billingUnit.trim() || null,
          }),
        },
      );
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not save service." : "Impossible d’enregistrer le service."));
      toast.success(editingId ? (en ? "Service updated." : "Service modifié.") : (en ? "Service created." : "Service créé."));
      setFormOpen(false);
      await loadServices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not save service." : "Impossible d’enregistrer le service."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (service: Service) => {
    try {
      const response = await fetch(`/api/admin/services/${service.id}`, { method: "DELETE" });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || (en ? "Could not delete service." : "Impossible de supprimer le service."));
      toast.success(en ? "Service deleted." : "Service supprimé.");
      setDeletingService(null);
      await loadServices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not delete service." : "Impossible de supprimer le service."));
    }
  };

  const importCurrentServices = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/services/import-current", { method: "POST" });
      const data: { services?: Service[]; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(data.services)) throw new Error(data.error || (en ? "Could not import services." : "Impossible d’importer les services."));
      setServices(data.services);
      toast.success(en ? "Existing services imported." : "Les services existants ont été importés.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (en ? "Could not import services." : "Impossible d’importer les services."));
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">{en ? "PUBLIC CONTENT" : "CONTENU DU SITE"}</span>
          <h1>{en ? "Services" : "Services"}</h1>
          <p>{en ? "Manage the services displayed on your website." : "Gérez les services présentés sur votre site."}</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={openNew}>
          <Plus size={18} /> {en ? "Add a service" : "Ajouter un service"}
        </button>
      </header>

      <div className="admin-summary-strip">
        <span><BriefcaseBusiness size={17} /> {services.length} {en ? "services" : "services"}</span>
        <span><Check size={17} /> {services.filter((service) => service.isActive).length} {en ? "visible on website" : "visibles sur le site"}</span>
        <button type="button" className="admin-quiet-button" onClick={refreshServices} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} /> {en ? "Refresh" : "Actualiser"}
        </button>
      </div>

      {formOpen && (
        <AdminDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          title={editingId ? (en ? "Edit service" : "Modifier le service") : (en ? "New service" : "Nouveau service")}
          description={en ? "Content is stored in French and English." : "Le contenu est enregistré en français et en anglais."}
          closeLabel={en ? "Close form" : "Fermer le formulaire"}
        >
        <form className="admin-dialog-form" onSubmit={save}>
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">{en ? "PUBLIC CONTENT" : "CONTENU DU SITE"}</span>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>{en ? "Title in French" : "Titre français"}<input required minLength={2} maxLength={160} value={form.titleFr} onChange={(event) => {
              const titleFr = event.target.value;
              setForm((current) => ({ ...current, titleFr, slug: editingId ? current.slug : slugify(titleFr) }));
            }} /></label>
            <label>{en ? "Title in English" : "Titre anglais"}<input required minLength={2} maxLength={160} value={form.titleEn} onChange={(event) => update("titleEn", event.target.value)} /></label>
            <label>{en ? "Sale price (XOF)" : "Tarif de vente (FCFA)"}<input type="number" min={0} step={1} value={form.unitPrice} onChange={(event) => update("unitPrice", event.target.value)} placeholder={en ? "Leave blank if not for sale" : "Laisser vide si non facturé au tarif fixe"} /></label>
            <label>{en ? "Billing unit" : "Unité de facturation"}<input required minLength={1} maxLength={40} value={form.billingUnit} onChange={(event) => update("billingUnit", event.target.value)} placeholder="page, copie, reliure…" /></label>
            <label>{en ? "Sales category" : "Catégorie de vente"}<select value={form.salesCategory} onChange={(event) => update("salesCategory", event.target.value)}><option value="GRAPHIC_DESIGN">Graphisme</option><option value="PRINTING">Impression</option><option value="ADVERTISING">Supports publicitaires</option><option value="OTHER">Autres prestations</option></select></label>
            <label>{en ? "Website category" : "Catégorie du site"}<select required value={form.serviceCategory ?? ""} onChange={(event) => update("serviceCategory", event.target.value)}>{serviceCategories.map(([key, titleFr, titleEn]) => <option key={key} value={key}>{en ? titleEn : titleFr}</option>)}</select></label>
            <label className="admin-form-full">{en ? "URL slug" : "Identifiant URL"}<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => update("slug", slugify(event.target.value))} /></label>
            <label>{en ? "Description in French" : "Description française"}<textarea required minLength={5} maxLength={2000} rows={5} value={form.descriptionFr} onChange={(event) => update("descriptionFr", event.target.value)} /></label>
            <label>{en ? "Description in English" : "Description anglaise"}<textarea required minLength={5} maxLength={2000} rows={5} value={form.descriptionEn} onChange={(event) => update("descriptionEn", event.target.value)} /></label>
            <ContentImageField value={form.coverImage} onChange={(coverImage) => update("coverImage", coverImage)} label={en ? "Service image" : "Image du service"} uploadLabel={en ? "Upload image" : "Téléverser une image"} removeLabel={en ? "Remove image" : "Retirer l’image"} />
            <label>{en ? "Display order" : "Ordre d’affichage"}<input type="number" min={0} max={10000} value={form.sortOrder} onChange={(event) => update("sortOrder", Number(event.target.value))} /></label>
            <label className="admin-checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} />{en ? "Visible on the website" : "Visible sur le site"}</label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-quiet-button" onClick={() => setFormOpen(false)}>{en ? "Cancel" : "Annuler"}</button>
            <button type="submit" className="admin-primary-button" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" size={17} />}
              {saving ? (en ? "Saving…" : "Enregistrement…") : (en ? "Save service" : "Enregistrer le service")}
            </button>
          </div>
        </form>
        </AdminDialog>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>{en ? "Your services" : "Vos services"}</h2><p>{en ? "Published entries appear on the public Services page." : "Les services actifs apparaissent sur la page publique Services."}</p></div>
        </div>
        {loading ? (
          <div className="admin-empty-state"><LoaderCircle className="animate-spin" size={24} />{en ? "Loading services…" : "Chargement des services…"}</div>
        ) : services.length === 0 ? (
          <div className="admin-empty-state"><BriefcaseBusiness size={26} /><strong>{en ? "No services saved yet" : "Aucun service enregistré"}</strong><span>{en ? "Import 15 editable service ideas with starter images, or create your own." : "Importez 15 idées de services modifiables avec des images de départ, ou créez les vôtres."}</span><div className="admin-empty-actions"><button type="button" className="admin-quiet-button" onClick={() => void importCurrentServices()} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />}{en ? "Import starter services" : "Importer les 15 services de départ"}</button><button type="button" className="admin-primary-button" onClick={openNew}><Plus size={17} />{en ? "Create a service" : "Créer un service"}</button></div></div>
        ) : (
          <div className="admin-service-list">
            {pageServices.map((service) => (
              <article className="admin-service-row" key={service.id}>
                <span className="admin-service-order">{String(service.sortOrder).padStart(2, "0")}</span>
                <div className="admin-service-copy">
                  <div className="admin-service-title-row">
                    <h3>{locale === "fr" ? service.titleFr : service.titleEn}</h3>
                    <span className={`admin-status-pill${service.isActive ? " is-active" : ""}`}>{service.isActive ? (en ? "Visible" : "Visible") : (en ? "Hidden" : "Masqué")}</span>
                  </div>
                  <p>{locale === "fr" ? service.descriptionFr : service.descriptionEn}</p>
                  <small>{serviceCategories.find(([key]) => key === service.serviceCategory)?.[en ? 2 : 1] ?? (en ? "Uncategorized" : "Non catégorisé")} · /{service.slug} · {service.unitPrice == null ? "Tarif libre" : `${new Intl.NumberFormat("fr-FR").format(service.unitPrice)} FCFA / ${service.billingUnit ?? "prestation"}`}</small>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="admin-icon-button" onClick={() => openEdit(service)} aria-label={en ? "Edit service" : "Modifier le service"}><Pencil size={17} /></button>
                  <button type="button" className="admin-icon-button is-danger" onClick={() => setDeletingService(service)} aria-label={en ? "Delete service" : "Supprimer le service"}><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {!loading && services.length > 0 && (
        <AdminPagination {...servicePagination} />
      )}
      <AdminConfirmDialog
        open={Boolean(deletingService)}
        onOpenChange={(open) => { if (!open) setDeletingService(null); }}
        title={en ? "Delete this service?" : "Supprimer ce service ?"}
        description={deletingService ? (en ? `“${deletingService.titleEn}” will be permanently removed.` : `« ${deletingService.titleFr} » sera définitivement supprimé.`) : ""}
        cancelLabel={en ? "Cancel" : "Annuler"}
        confirmLabel={en ? "Delete service" : "Supprimer le service"}
        onConfirm={() => { if (deletingService) void remove(deletingService); }}
      />
    </div>
  );
}
