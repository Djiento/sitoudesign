"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Boxes, CircleAlert, LoaderCircle, PackagePlus, RefreshCw, Warehouse } from "lucide-react";
import { toast } from "sonner";
import AdminDialog from "@/components/admin/AdminDialog";
import AdminPagination from "@/components/admin/AdminPagination";
import { type AdminPageSize } from "@/lib/admin-pagination";

type StockItem = {
  id: string; sku: string; name: string; unit: string;
  quantityOnHand: string; quantityReserved: string; reorderThreshold: string; isActive: boolean;
  balances: { quantityOnHand: string; quantityReserved: string; location: { id: string; name: string } }[];
};
type StockLocation = { id: string; name: string };
type ProductOption = { id: string; slug: string; nameFr: string; nameEn: string };
type ProductVariant = {
  id: string; sku: string; color: string | null; size: string | null;
  quantityOnHand: string; quantityReserved: string; reorderThreshold: string; unitPrice: number; isActive: boolean;
  product: { id: string; nameFr: string; nameEn: string };
  balances: { quantityOnHand: string; quantityReserved: string; location: StockLocation }[];
};
type MovementVariant = {
  sku: string; color: string | null; size: string | null;
  product: { nameFr: string };
};
type StockMovement = {
  id: string; type: string; quantity: string; reason: string; reference: string | null; createdAt: string;
  item: { id: string; sku: string; name: string; unit: string } | null;
  productVariant?: MovementVariant | null;
  actor: { id: string; fullName: string };
  order?: { orderNumber: string } | null;
  location: StockLocation;
  destinationLocation?: StockLocation | null;
};
type StockData = {
  items: StockItem[];
  variants: ProductVariant[];
  products: ProductOption[];
  movements: StockMovement[];
  locations: StockLocation[];
  lowStockCount: number;
  movementPagination: { page: number; pageSize: AdminPageSize; total: number; totalPages: number };
  variantPagination: { page: number; pageSize: AdminPageSize; total: number; totalPages: number };
  lowStockVariants: Pick<ProductVariant, "id" | "sku" | "color" | "size" | "quantityOnHand" | "quantityReserved" | "reorderThreshold" | "product">[];
};

const movementLabels: Record<string, string> = {
  RECEIPT: "Réception", ISSUE: "Sortie / consommation", RESERVATION: "Réservation",
  RELEASE: "Libération de réservation",
  TRANSFER_OUT: "Transfert sortant", ADJUSTMENT: "Correction d’inventaire",
};

export default function InventoryManager({ isAdmin, initialOrderId, isCashier = false }: { isAdmin: boolean; initialOrderId?: string; isCashier?: boolean }) {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(Boolean(initialOrderId));
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unité");
  const [threshold, setThreshold] = useState("0");
  const [productId, setProductId] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantColor, setVariantColor] = useState("");
  const [variantSize, setVariantSize] = useState("");
  const [variantThreshold, setVariantThreshold] = useState("0");
  const [variantPrice, setVariantPrice] = useState("0");
  const [itemId, setItemId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [stockTarget, setStockTarget] = useState<"ITEM" | "VARIANT">("ITEM");
  const [locationId, setLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [movementType, setMovementType] = useState(initialOrderId && isCashier ? "ISSUE" : "RECEIPT");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState("IN");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [orderId, setOrderId] = useState(initialOrderId ?? "");
  const [search, setSearch] = useState("");

  const load = useCallback(async (
    query = "",
    page = 1,
    pageSize: AdminPageSize = 25,
    variantPage = 1,
    variantPageSize: AdminPageSize = 25,
  ) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        variantPage: String(variantPage),
        variantPageSize: String(variantPageSize),
      });
      if (query) params.set("q", query);
      const response = await fetch(`/api/admin/stock?${params}`, { cache: "no-store" });
      const result: StockData & { error?: string } = await response.json();
      if (!response.ok || !Array.isArray(result.items)) throw new Error(result.error || "Impossible de charger le stock.");
      setData(result);
      if (!itemId && result.items[0]) setItemId(result.items[0].id);
      if (!variantId && result.variants[0]) setVariantId(result.variants[0].id);
      if (!result.items.some((item) => item.isActive) && result.variants.some((variant) => variant.isActive)) setStockTarget("VARIANT");
      if (!productId && result.products[0]) setProductId(result.products[0].id);
      if (!locationId && result.locations[0]) setLocationId(result.locations[0].id);
      if (!destinationLocationId && result.locations[1]) setDestinationLocationId(result.locations[1].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger le stock.");
    } finally {
      setLoading(false);
    }
  }, [itemId, variantId, productId, locationId, destinationLocationId]);

  function changeMovementPage(page: number, pageSize: AdminPageSize = data?.movementPagination.pageSize ?? 25) {
    setLoading(true);
    void load(search, page, pageSize, data?.variantPagination.page ?? 1, data?.variantPagination.pageSize ?? 25);
  }

  function changeVariantPage(page: number, pageSize: AdminPageSize = data?.variantPagination.pageSize ?? 25) {
    setLoading(true);
    void load(search, data?.movementPagination.page ?? 1, data?.movementPagination.pageSize ?? 25, page, pageSize);
  }

  // Fetch the protected stock ledger on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/stock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, name, unit, reorderThreshold: Number(threshold) }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de créer la fiche.");
      toast.success("Fiche matière créée.");
      setSku(""); setName(""); setThreshold("0"); setShowItemForm(false);
      await load(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer la fiche.");
    } finally {
      setSaving(false);
    }
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/stock/variants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId, sku: variantSku, color: variantColor, size: variantSize,
          reorderThreshold: Number(variantThreshold), unitPrice: Number(variantPrice),
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de créer la variante.");
      toast.success("Variante créée.");
      setVariantSku(""); setVariantColor(""); setVariantSize(""); setVariantThreshold("0"); setVariantPrice("0");
      setShowVariantForm(false);
      await load(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer la variante.");
    } finally {
      setSaving(false);
    }
  }

  async function updateVariantPrice(variant: ProductVariant, unitPrice: number) {
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      toast.error("Le tarif doit être un montant entier positif ou nul.");
      return;
    }
    if (unitPrice === variant.unitPrice) return;
    try {
      const response = await fetch(`/api/admin/stock/variants/${encodeURIComponent(variant.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPrice }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de modifier le tarif.");
      toast.success("Tarif de la variante mis à jour.");
      await load(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier le tarif.");
    }
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(stockTarget === "VARIANT" ? `/api/admin/stock/variants/${encodeURIComponent(variantId)}/movements` : "/api/admin/stock", {
        method: stockTarget === "VARIANT" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(stockTarget === "ITEM" ? { itemId } : {}),
          locationId,
          destinationLocationId: movementType === "TRANSFER_OUT" ? destinationLocationId : undefined,
          type: movementType,
          quantity: Number(quantity),
          direction: movementType === "ADJUSTMENT" ? direction : undefined,
          reason,
          reference,
          orderId: orderId || undefined,
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d’enregistrer le mouvement.");
      toast.success("Mouvement de stock tracé.");
      setQuantity(""); setReason(""); setReference(""); setOrderId("");
      setShowMovementForm(false);
      await load(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer le mouvement.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/stock/emplacements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: locationName }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de créer l’emplacement.");
      toast.success("Emplacement créé.");
      setLocationName("");
      setShowLocationForm(false);
      await load(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer l’emplacement.");
    } finally {
      setSaving(false);
    }
  }

  const lowStockItems = data?.items.filter((item) => Number(item.quantityOnHand) - Number(item.quantityReserved) <= Number(item.reorderThreshold)) ?? [];
  const lowStockVariants = data?.lowStockVariants ?? [];

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div><span className="admin-eyebrow">APPROVISIONNEMENT · TRAÇABILITÉ</span><h1>Gestion de stock</h1><p>Suivez les matières et les stocks indépendants par produit, couleur et taille.</p></div>
        {isAdmin && <div className="admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setShowLocationForm((open) => !open)}><Warehouse size={17} />Nouvel emplacement</button><button type="button" className="admin-quiet-button" onClick={() => setShowVariantForm(true)} disabled={!data?.products.length}><PackagePlus size={17} />Nouvelle variante</button><button type="button" className="admin-primary-button" onClick={() => setShowItemForm((open) => !open)}><PackagePlus size={18} />Nouvelle matière</button></div>}
      </header>
      <section className="admin-finance-kpis">
        <article className="admin-finance-kpi"><span>Fiches matières actives</span><strong>{data?.items.filter((item) => item.isActive).length ?? "—"}</strong><small>Références suivies</small></article>
        <article className={`admin-finance-kpi${lowStockItems.length || lowStockVariants.length ? " is-warning" : ""}`}><span>Alertes de réapprovisionnement</span><strong>{data?.lowStockCount ?? "—"}</strong><small>Disponible inférieur ou égal au seuil</small></article>
        <article className="admin-finance-kpi"><span>Mouvements récents</span><strong>{data?.movements.length ?? "—"}</strong><small>Entrées, sorties, réservations et corrections</small></article>
      </section>

      {showLocationForm && (
        <AdminDialog open={showLocationForm} onOpenChange={setShowLocationForm} title="Ajouter un emplacement" description="Un emplacement distinct permet de suivre les transferts sans modifier le stock total." closeLabel="Fermer le formulaire">
          <form className="admin-form-grid" onSubmit={(event) => void saveLocation(event)}>
            <label className="admin-form-full">Nom de l’emplacement<input required minLength={2} maxLength={80} value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Ex. Réserve principale" /></label>
            <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setShowLocationForm(false)}>Annuler</button><button className="admin-primary-button" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Warehouse size={16} />}Créer l’emplacement</button></div>
          </form>
        </AdminDialog>
      )}

      {showItemForm && (
        <AdminDialog open={showItemForm} onOpenChange={setShowItemForm} title="Créer une fiche matière" description="Définis une unité de suivi et un seuil d’alerte." closeLabel="Fermer le formulaire">
          <form className="admin-form-grid" onSubmit={(event) => void saveItem(event)}>
            <label>Référence (SKU)<input required minLength={2} maxLength={60} value={sku} onChange={(event) => setSku(event.target.value.toUpperCase())} placeholder="Ex. PAPIER-A3-300" /></label>
            <label>Nom de la matière<input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Papier couché 300 g" /></label>
            <label>Unité de mesure<input required minLength={1} maxLength={30} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="feuille, rouleau, mètre…" /></label>
            <label>Seuil de réapprovisionnement<input type="number" min={0} step="0.001" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
            <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setShowItemForm(false)}>Annuler</button><button className="admin-primary-button" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <PackagePlus size={16} />}Créer la matière</button></div>
          </form>
        </AdminDialog>
      )}

      {showVariantForm && (
        <AdminDialog open={showVariantForm} onOpenChange={setShowVariantForm} title="Créer une variante de produit" description="Chaque combinaison de couleur et taille disposera de ses propres quantités et mouvements." closeLabel="Fermer le formulaire">
          <form className="admin-form-grid" onSubmit={(event) => void saveVariant(event)}>
            <label className="admin-form-full">Produit<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Sélectionner…</option>{data?.products.map((product) => <option key={product.id} value={product.id}>{product.nameFr} · {product.slug}</option>)}</select></label>
            <label>Référence (SKU)<input required minLength={2} maxLength={60} value={variantSku} onChange={(event) => setVariantSku(event.target.value.toUpperCase())} placeholder="Ex. TSHIRT-ROUGE-M" /></label>
            <label>Couleur<input maxLength={60} value={variantColor} onChange={(event) => setVariantColor(event.target.value)} placeholder="Ex. Rouge" /></label>
            <label>Taille<input maxLength={60} value={variantSize} onChange={(event) => setVariantSize(event.target.value)} placeholder="Ex. M" /></label>
            <label>Seuil de réapprovisionnement<input type="number" min={0} step="0.001" value={variantThreshold} onChange={(event) => setVariantThreshold(event.target.value)} /></label>
            <label>Tarif de vente (FCFA)<input required type="number" min={0} step={1} value={variantPrice} onChange={(event) => setVariantPrice(event.target.value)} /></label>
            <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setShowVariantForm(false)}>Annuler</button><button className="admin-primary-button" disabled={saving || !productId || (!variantColor.trim() && !variantSize.trim())}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <PackagePlus size={16} />}Créer la variante</button></div>
          </form>
        </AdminDialog>
      )}

      <section className="admin-finance-columns">
        <article className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Mouvements de stock</h2><p>Chaque mouvement est daté, attribué à son auteur et conservé sans suppression.</p></div><Warehouse size={20} /></div>
          <button type="button" className="admin-primary-button" onClick={() => setShowMovementForm(true)} disabled={(!data?.items.length && !data?.variants.length) || !data?.locations.length}><Boxes size={16} />Enregistrer un mouvement</button>
        </article>
        <article className="admin-panel">
          <div className="admin-panel-heading"><div><h2>À réapprovisionner</h2><p>Stock disponible après déduction des réservations.</p></div><CircleAlert size={20} /></div>
          {lowStockItems.map((item) => <div className="admin-report-row" key={item.id}><span>{item.name}<small>{item.sku} · seuil {item.reorderThreshold} {item.unit}</small></span><strong>{(Number(item.quantityOnHand) - Number(item.quantityReserved)).toLocaleString("fr-FR")} {item.unit}</strong></div>)}
          {lowStockVariants.map((variant) => <div className="admin-report-row" key={variant.id}><span>{variant.product.nameFr} · {[variant.color, variant.size].filter(Boolean).join(" / ")}<small>{variant.sku} · seuil {variant.reorderThreshold}</small></span><strong>{(Number(variant.quantityOnHand) - Number(variant.quantityReserved)).toLocaleString("fr-FR")}</strong></div>)}
          {!lowStockItems.length && !lowStockVariants.length && <p className="admin-muted-copy">Aucune alerte de stock pour le moment.</p>}
        </article>
      </section>

      <AdminDialog open={showMovementForm} onOpenChange={setShowMovementForm} title="Enregistrer un mouvement" description="Le mouvement sera daté, attribué à ton compte et ajouté à l’historique." closeLabel="Fermer le formulaire">
        <form className="admin-form-grid" onSubmit={(event) => void saveMovement(event)}>
          <label>Type d’article<select value={stockTarget} onChange={(event) => setStockTarget(event.target.value as "ITEM" | "VARIANT")}><option value="ITEM">Matière</option><option value="VARIANT">Variante de produit</option></select></label>
          {stockTarget === "ITEM"
            ? <label className="admin-form-full">Matière<select required value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">Sélectionner…</option>{data?.items.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name} ({item.unit})</option>)}</select></label>
            : <label className="admin-form-full">Variante<select required value={variantId} onChange={(event) => setVariantId(event.target.value)}><option value="">Sélectionner…</option>{data?.variants.filter((variant) => variant.isActive).map((variant) => <option key={variant.id} value={variant.id}>{variant.sku} · {variant.product.nameFr} · {[variant.color, variant.size].filter(Boolean).join(" / ")}</option>)}</select></label>}
          <label>Type de mouvement<select value={movementType} onChange={(event) => setMovementType(event.target.value)} disabled={isCashier}>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>{movementType === "TRANSFER_OUT" ? "Emplacement source" : "Emplacement"}<select required value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Sélectionner…</option>{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          {movementType === "TRANSFER_OUT" && <label>Emplacement destinataire<select required value={destinationLocationId} onChange={(event) => setDestinationLocationId(event.target.value)}><option value="">Sélectionner…</option>{data?.locations.filter((location) => location.id !== locationId).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
          {movementType === "ADJUSTMENT" && <label>Correction<select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="IN">Augmenter le stock</option><option value="OUT">Réduire le stock</option></select></label>}
          <label>Quantité<input required type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
          <label>Référence justificative (facultatif)<input maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bon de livraison, inventaire…" /></label>
          <label className="admin-form-full">Commande liée{isCashier ? <input required readOnly value={orderId} /> : <input maxLength={120} value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Rattacher une consommation à une commande" />}{initialOrderId && <small>Commande préremplie depuis le lien. Le mouvement reste manuel : aucune déduction automatique n’est effectuée.</small>}</label>
          <label className="admin-form-full">Motif / justificatif<textarea required minLength={5} maxLength={2000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique la réception, la sortie ou l’écart constaté…" /></label>
          <div className="admin-form-full admin-form-actions"><button type="button" className="admin-quiet-button" onClick={() => setShowMovementForm(false)}>Annuler</button><button className="admin-primary-button" disabled={saving || (stockTarget === "ITEM" ? !itemId : !variantId) || !data?.locations.length}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Boxes size={16} />}Enregistrer le mouvement</button></div>
        </form>
      </AdminDialog>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Fiches matières</h2><p>Disponible = stock physique moins les quantités réservées.</p></div>
          <form className="admin-stock-search" onSubmit={(event) => { event.preventDefault(); setLoading(true); void load(search); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou référence…" /><button className="admin-quiet-button"><RefreshCw size={15} />Rechercher</button></form>
        </div>
        {loading ? <div className="admin-empty-state"><LoaderCircle className="animate-spin" />Chargement du stock…</div> : (
          <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Référence · matière</th><th>En stock</th><th>Réservé</th><th>Disponible</th><th>Seuil</th><th>État</th></tr></thead><tbody>
            {data?.items.map((item) => {
              const available = Number(item.quantityOnHand) - Number(item.quantityReserved);
              const low = available <= Number(item.reorderThreshold);
              const locationSummary = item.balances.map((balance) => `${balance.location.name}: ${Number(balance.quantityOnHand).toLocaleString("fr-FR")} ${item.unit}`).join(" · ");
              return <tr key={item.id}><td>{item.sku}<small>{item.name}</small><small>{locationSummary || "Aucun emplacement"}</small></td><td>{Number(item.quantityOnHand).toLocaleString("fr-FR")} {item.unit}</td><td>{Number(item.quantityReserved).toLocaleString("fr-FR")} {item.unit}</td><td>{available.toLocaleString("fr-FR")} {item.unit}</td><td>{Number(item.reorderThreshold).toLocaleString("fr-FR")} {item.unit}</td><td><span className={`admin-status-pill${low ? "" : " is-active"}`}>{low ? "À commander" : "Disponible"}</span></td></tr>;
            })}
            {!data?.items.length && <tr><td colSpan={6}>Aucune fiche matière trouvée.</td></tr>}
          </tbody></table></div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Variantes de produits</h2><p>Chaque couleur et taille possède un solde indépendant par emplacement.</p></div></div>
        <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Produit · variante</th><th>En stock</th><th>Réservé</th><th>Disponible</th><th>Seuil</th><th>Tarif (FCFA)</th><th>État</th></tr></thead><tbody>
          {data?.variants.map((variant) => {
            const available = Number(variant.quantityOnHand) - Number(variant.quantityReserved);
            const low = available <= Number(variant.reorderThreshold);
            const optionLabel = [variant.color, variant.size].filter(Boolean).join(" / ");
            const locationSummary = variant.balances.map((balance) => `${balance.location.name}: ${Number(balance.quantityOnHand).toLocaleString("fr-FR")}`).join(" · ");
            return <tr key={variant.id}><td>{variant.sku}<small>{variant.product.nameFr} · {optionLabel}</small><small>{locationSummary || "Aucun emplacement"}</small></td><td>{Number(variant.quantityOnHand).toLocaleString("fr-FR")}</td><td>{Number(variant.quantityReserved).toLocaleString("fr-FR")}</td><td>{available.toLocaleString("fr-FR")}</td><td>{Number(variant.reorderThreshold).toLocaleString("fr-FR")}</td><td><input aria-label={`Tarif ${variant.sku}`} type="number" min={0} step={1} defaultValue={variant.unitPrice} onBlur={(event) => void updateVariantPrice(variant, Number(event.target.value))} disabled={!isAdmin} /></td><td><span className={`admin-status-pill${low ? "" : " is-active"}`}>{low ? "À commander" : "Disponible"}</span></td></tr>;
          })}
          {!data?.variants.length && <tr><td colSpan={7}>Aucune variante suivie. Les produits existants restent inchangés tant qu’aucune variante n’est créée.</td></tr>}
        </tbody></table></div>
        {data?.variantPagination && <AdminPagination
          page={data.variantPagination.page}
          pageSize={data.variantPagination.pageSize}
          total={data.variantPagination.total}
          totalPages={data.variantPagination.totalPages}
          onPageChange={(page) => changeVariantPage(page)}
          onPageSizeChange={(pageSize) => changeVariantPage(1, pageSize)}
        />}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Journal des mouvements</h2><p>{data?.movementPagination.total ?? 0} mouvement(s) · La correction d’inventaire exige un motif.</p></div></div>
        <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Date</th><th>Article</th><th>Mouvement</th><th>Quantité</th><th>Commande</th><th>Référence / motif</th><th>Par</th></tr></thead><tbody>
          {data?.movements.map((movement) => {
            const itemTitle = movement.item
              ? `${movement.item.sku} · ${movement.item.name}`
              : `${movement.productVariant?.sku ?? "Variante"} · ${movement.productVariant?.product.nameFr ?? ""} · ${[movement.productVariant?.color, movement.productVariant?.size].filter(Boolean).join(" / ")}`;
            return <tr key={movement.id}><td>{new Date(movement.createdAt).toLocaleString("fr-FR")}</td><td>{itemTitle}</td><td>{movementLabels[movement.type] ?? movement.type}<small>{movement.location.name}{movement.destinationLocation ? ` → ${movement.destinationLocation.name}` : ""}</small></td><td>{Number(movement.quantity).toLocaleString("fr-FR")} {movement.item?.unit ?? "unité"}</td><td>{movement.order?.orderNumber ?? "—"}</td><td>{movement.reference || movement.reason}</td><td>{movement.actor.fullName}</td></tr>;
          })}
          {!data?.movements.length && <tr><td colSpan={7}>Aucun mouvement enregistré.</td></tr>}
        </tbody></table></div>
        {data?.movementPagination && <AdminPagination
          page={data.movementPagination.page}
          pageSize={data.movementPagination.pageSize}
          total={data.movementPagination.total}
          totalPages={data.movementPagination.totalPages}
          onPageChange={(page) => changeMovementPage(page)}
          onPageSizeChange={(pageSize) => changeMovementPage(1, pageSize)}
        />}
      </section>
    </div>
  );
}
