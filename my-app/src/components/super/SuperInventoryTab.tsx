import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import FgcAmount from "../credits/FgcAmount";
import type { ApiStoreItem, ApiStoreOrder } from "../../api";
import { uploadFilesToStoreImages } from "../../lib/storeUploads";

declare const M: any;

type FormState = {
  name: string;
  description: string;
  category: string;
  image_url: string;
  image_urls: string[];
  price_fgc: string;
  stock: string;
  custom_order: boolean;
  status: "active" | "inactive";
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    category: "",
    image_url: "",
    image_urls: [],
    price_fgc: "",
    stock: "0",
    custom_order: false,
    status: "active",
  };
}

export default function SuperInventoryTab() {
  const { api } = useAuth();
  const [items, setItems] = useState<ApiStoreItem[]>([]);
  const [orders, setOrders] = useState<ApiStoreOrder[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [imageUploadFiles, setImageUploadFiles] = useState<File[]>([]);
  const [imageUploadNames, setImageUploadNames] = useState<string[]>([]);
  const [imageUploadPreviews, setImageUploadPreviews] = useState<string[]>([]);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [categoryPreset, setCategoryPreset] = useState("__custom__");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const stockBeforeCustomOrderRef = useRef<string>("0");

  async function loadData() {
    setLoading(true);
    try {
      const [nextItems, nextOrders] = await Promise.all([
        api.getStoreAdminItems(),
        api.getStoreAdminOrders(),
      ]);
      setItems(Array.isArray(nextItems) ? nextItems : []);
      setOrders(Array.isArray(nextOrders) ? nextOrders : []);
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to load inventory", classes: "red" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function startEdit(item: ApiStoreItem) {
    setSelectedItemId(item.item_id);
    const category = safeStr(item.category);
    setCategoryPreset(category ? category : "__custom__");
    stockBeforeCustomOrderRef.current = String(Math.max(0, Math.round(safeNum(item.stock))));
    setForm({
      name: safeStr(item.name),
      description: safeStr(item.description),
      category: safeStr(item.category),
      image_url: safeStr(item.image_url),
      image_urls: Array.isArray((item as any).image_urls)
        ? (item as any).image_urls.map((url: any) => safeStr(url)).filter(Boolean)
        : safeStr(item.image_url)
          ? [safeStr(item.image_url)]
          : [],
      price_fgc: String(safeNum(item.price_cents) / 100),
      stock: String(safeNum(item.stock)),
      custom_order: Boolean(item.custom_order),
      status: (item.status as "active" | "inactive") || "active",
    });
  }

  function resetForm() {
    setSelectedItemId("");
    setCategoryPreset("__custom__");
    setForm(emptyForm());
    stockBeforeCustomOrderRef.current = "0";
    clearSelectedImages();
  }

  function clearSelectedImages() {
    setImageUploadFiles([]);
    setImageUploadNames([]);
    setImageUploadPreviews([]);
    setImageUploadProgress(0);
    setImageUploading(false);
    setImageUploadError("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function setSelectedImages(files: File[]) {
    const nextFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    setImageUploadFiles(nextFiles);
    setImageUploadNames(nextFiles.map((file) => file.name));
    setImageUploadPreviews(nextFiles.map((file) => URL.createObjectURL(file)));
    setImageUploadProgress(0);
    setImageUploadError("");
  }

  useEffect(() => {
    return () => {
      imageUploadPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageUploadPreviews]);

  async function uploadSelectedImages(itemName: string) {
    if (!imageUploadFiles.length) return [];
    if (!safeStr(itemName)) {
      throw new Error("Enter a merch name first so the upload can be grouped");
    }

    setImageUploading(true);
    setImageUploadError("");
    try {
      return await uploadFilesToStoreImages(
        api,
        imageUploadFiles,
        itemName,
        (pct) => setImageUploadProgress(pct)
      );
    } catch (err: any) {
      const msg = String(err?.message || "Failed to upload image");
      setImageUploadError(msg);
      throw new Error(msg);
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!safeStr(form.name) || !safeStr(form.price_fgc)) {
      M?.toast?.({ html: "Name and price are required", classes: "red" });
      return;
    }

    setSaving(true);
    try {
      const uploaded = await uploadSelectedImages(form.name);
      const uploadedUrls = uploaded.map((file) => safeStr(file.publicUrl)).filter(Boolean);
      const nextImageUrls = Array.from(
        new Set([
          safeStr(form.image_url),
          ...form.image_urls.map((url) => safeStr(url)),
          ...uploadedUrls,
        ].filter(Boolean))
      );
      await api.saveStoreItem({
        item_id: selectedItemId || undefined,
        name: safeStr(form.name),
        description: safeStr(form.description),
        category: safeStr(form.category),
        image_url: safeStr(form.image_url || nextImageUrls[0] || ""),
        image_urls: nextImageUrls,
        price_cents: Math.round(Number(form.price_fgc) * 100),
        stock: form.custom_order ? 0 : Math.max(0, Math.round(Number(form.stock))),
        custom_order: Boolean(form.custom_order),
        status: form.status,
      });
      M?.toast?.({ html: selectedItemId ? "Inventory item updated" : "Inventory item created", classes: "green" });
      resetForm();
      await loadData();
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to save item", classes: "red" });
    } finally {
      setSaving(false);
    }
  }

  const totalStock = useMemo(() => items.reduce((acc, item) => acc + safeNum(item.stock), 0), [items]);
  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      const category = safeStr(item.category);
      if (category) seen.add(category);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <div className="suCard">
      <div className="card-content">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>Store Inventory</div>
            <div style={{ color: "#475569" }}>Create merch items, set FGC prices, and manage stock for the employee store.</div>
          </div>
          <button type="button" className="btn-flat" onClick={() => void loadData()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 16, marginTop: 16 }}>
          <div style={{ border: "1px solid #e6edf2", borderRadius: 18, padding: 14, background: "#fbfdff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Items</div>
                <div style={{ fontSize: 24, fontWeight: 1000, color: "#0f172a" }}>{items.length}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Total stock</div>
                <div style={{ fontSize: 24, fontWeight: 1000, color: "#0f172a" }}>{totalStock}</div>
              </div>
            </div>

            <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 8 }}>
              <div className="input-field">
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Classic Hoodie"
                />
                <label className="active">Name</label>
              </div>
              <div className="input-field">
                <textarea
                  className="materialize-textarea"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Warm heavyweight hoodie with studio logo."
                />
                <label className="active">Description</label>
              </div>
              <div className="input-field">
                <select
                  className="browser-default"
                  value={categoryPreset}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCategoryPreset(next);
                    if (next !== "__custom__") {
                      setForm((prev) => ({ ...prev, category: next }));
                    }
                  }}
                >
                  <option value="__custom__">Choose existing category...</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <label className="active">Category preset</label>
              </div>
              <div className="input-field">
                <input
                  value={form.category}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCategoryPreset("__custom__");
                    setForm((prev) => ({ ...prev, category: next }));
                  }}
                  placeholder="Apparel or new category"
                />
                <label className="active">Category</label>
              </div>
              <div className="input-field">
                <input
                  value={form.image_url}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = e.target.value;
                      return {
                        ...prev,
                        image_url: next,
                        image_urls: prev.image_urls.length ? prev.image_urls : (next ? [next] : []),
                      };
                    })
                  }
                  placeholder="https://..."
                />
                <label className="active">Primary image URL</label>
              </div>
              <div style={{ border: "1px dashed #cbd5e1", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Upload images to S3</div>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      setSelectedImages(Array.from(e.target.files || []));
                    }}
                  />
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                    {imageUploadNames.length
                      ? `Selected: ${imageUploadNames.slice(0, 3).join(", ")}${imageUploadNames.length > 3 ? ` +${imageUploadNames.length - 3} more` : ""}`
                      : "Choose one or more merch images. They will preview here now and upload when you save the item."}
                  </div>
                  {imageUploadPreviews.length ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                      {imageUploadPreviews.map((url, index) => (
                        <div key={`${url}-${index}`} style={{ border: "1px solid #e6edf2", borderRadius: 14, padding: 8, background: "#fff" }}>
                          <div style={{ height: 92, borderRadius: 10, overflow: "hidden", background: "#f8fafc", display: "grid", placeItems: "center" }}>
                            <img src={url} alt={imageUploadNames[index] || "Selected merch"} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "cover" }} />
                          </div>
                          <div style={{ marginTop: 8, color: "#475569", fontSize: 12, fontWeight: 700, wordBreak: "break-word" }}>
                            {imageUploadNames[index] || "Selected image"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {imageUploading ? (
                    <div style={{ color: "#1d4ed8", fontWeight: 800, fontSize: 12 }}>
                      Uploading images during save... {imageUploadProgress}%
                    </div>
                  ) : null}
                  {imageUploadError ? (
                    <div style={{ color: "#b91c1c", fontWeight: 800, fontSize: 12 }}>{imageUploadError}</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-flat"
                      onClick={() => {
                        clearSelectedImages();
                      }}
                      disabled={imageUploading}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
              {form.image_urls.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
                    Uploaded images
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                    {form.image_urls.map((url) => (
                      <div key={url} style={{ border: "1px solid #e6edf2", borderRadius: 14, padding: 8, background: "#fff" }}>
                        <div style={{ height: 92, borderRadius: 10, overflow: "hidden", background: "#f8fafc", display: "grid", placeItems: "center" }}>
                          <img src={url} alt="Uploaded merch" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn-flat"
                            onClick={() => setForm((prev) => ({ ...prev, image_url: url }))}
                            disabled={form.image_url === url}
                          >
                            Primary
                          </button>
                          <button
                            type="button"
                            className="btn-flat"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                image_urls: prev.image_urls.filter((current) => current !== url),
                                image_url: prev.image_url === url ? prev.image_urls.find((current) => current !== url) || "" : prev.image_url,
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="input-field">
                <input
                  type="number"
                  step="0.01"
                  value={form.price_fgc}
                  onChange={(e) => setForm((prev) => ({ ...prev, price_fgc: e.target.value }))}
                  placeholder="25.00"
                />
                <label className="active">Price (FGC)</label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#0f172a", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.custom_order}
                    onChange={(e) =>
                      setForm((prev) => {
                        if (e.target.checked) {
                          stockBeforeCustomOrderRef.current = prev.stock;
                          return {
                            ...prev,
                            custom_order: true,
                            stock: "0",
                          };
                        }
                        return {
                          ...prev,
                          custom_order: false,
                          stock: stockBeforeCustomOrderRef.current || prev.stock || "0",
                        };
                      })
                    }
                    style={{
                      position: "static",
                      opacity: 1,
                      pointerEvents: "auto",
                      width: 16,
                      height: 16,
                      margin: 0,
                      accentColor: "#2563eb",
                    }}
                  />
                  Custom order item
                </label>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  Custom order items are request-only and do not keep inventory.
                </span>
              </div>
              <div className="input-field">
                <input
                  type="number"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
                  placeholder="10"
                  disabled={form.custom_order}
                />
                <label className="active">{form.custom_order ? "Stock (request-only)" : "Stock"}</label>
              </div>
              <div className="input-field">
                <select
                  className="browser-default"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as FormState["status"] }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <label className="active">Status</label>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Saving..." : selectedItemId ? "Update Item" : "Create Item"}
                </button>
                <button type="button" className="btn-flat" onClick={resetForm} disabled={saving}>
                  Reset
                </button>
              </div>
            </form>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ border: "1px solid #e6edf2", borderRadius: 18, padding: 14, background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Current items</div>
              <div style={{ display: "grid", gap: 10 }}>
                {items.length ? items.map((item) => (
                  <div
                    key={item.item_id}
                    style={{
                      border: "1px solid #e6edf2",
                      borderRadius: 14,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 1000, color: "#0f172a" }}>{item.name}</div>
                      <div style={{ color: "#475569", fontSize: 13, marginTop: 6 }}>{item.description || "No description"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 1000, color: "#0f172a" }}>
                        <FgcAmount amount={safeNum(item.price_cents)} style={{ fontWeight: 1000, color: "#0f172a" }} iconSize={30} />
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Stock {safeNum(item.stock)}</div>
                      <button type="button" className="btn-flat" onClick={() => startEdit(item)} style={{ marginTop: 8 }}>
                        Edit
                      </button>
                    </div>
                  </div>
                )) : <div className="emptyState">No inventory items yet.</div>}
              </div>
            </div>

            <div style={{ border: "1px solid #e6edf2", borderRadius: 18, padding: 14, background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Recent orders</div>
              <div style={{ display: "grid", gap: 10 }}>
                {orders.length ? orders.slice(0, 10).map((order) => (
                  <div
                    key={order.order_id}
                    style={{
                      border: "1px solid #e6edf2",
                      borderRadius: 14,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 950, color: "#0f172a" }}>{order.item_name || order.item_id}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                        {order.username} · {order.quantity} x <FgcAmount amount={safeNum(order.unit_price_cents)} style={{ fontSize: 13, fontWeight: 800, color: "#475569" }} iconSize={30} /> · {order.created_at}
                      </div>
                    </div>
                    <div style={{ fontWeight: 1000, color: "#0f172a" }}>
                      <FgcAmount amount={safeNum(order.total_cents)} style={{ fontWeight: 1000, color: "#0f172a" }} iconSize={30} />
                    </div>
                  </div>
                )) : <div className="emptyState">No purchases yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
