import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import FgcAmount from "../credits/FgcAmount";
import type { ApiStoreItem, ApiStoreOrder } from "../../api";
import { uploadFileToStoreImages } from "../../lib/storeUploads";

declare const M: any;

type FormState = {
  name: string;
  description: string;
  category: string;
  image_url: string;
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
  const [imageUploadFile, setImageUploadFile] = useState<File | null>(null);
  const [imageUploadName, setImageUploadName] = useState("");
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
    setImageUploadFile(null);
    setImageUploadName("");
    setImageUploadProgress(0);
    setImageUploading(false);
    setImageUploadError("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function uploadImage() {
    if (!imageUploadFile) {
      M?.toast?.({ html: "Choose an image file first", classes: "orange" });
      return;
    }
    if (!safeStr(form.name)) {
      M?.toast?.({ html: "Enter a merch name first so the upload can be grouped", classes: "orange" });
      return;
    }

    setImageUploading(true);
    setImageUploadError("");
    try {
      const uploaded = await uploadFileToStoreImages(
        api,
        imageUploadFile,
        form.name,
        (pct) => setImageUploadProgress(pct)
      );
      if (uploaded.publicUrl) {
        setForm((prev) => ({ ...prev, image_url: uploaded.publicUrl || "" }));
      }
      M?.toast?.({ html: "Image uploaded to S3", classes: "green" });
    } catch (err: any) {
      const msg = String(err?.message || "Failed to upload image");
      setImageUploadError(msg);
      M?.toast?.({ html: msg, classes: "red" });
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
      await api.saveStoreItem({
        item_id: selectedItemId || undefined,
        name: safeStr(form.name),
        description: safeStr(form.description),
        category: safeStr(form.category),
        image_url: safeStr(form.image_url),
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
                  onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                  placeholder="https://..."
                />
                <label className="active">Image URL</label>
              </div>
              <div style={{ border: "1px dashed #cbd5e1", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Upload image to S3</div>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setImageUploadFile(file);
                      setImageUploadName(file?.name || "");
                      setImageUploadProgress(0);
                      setImageUploadError("");
                    }}
                  />
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                    {imageUploadName ? `Selected: ${imageUploadName}` : "Choose a merch image, upload it, and the S3 public URL will fill in automatically."}
                  </div>
                  {imageUploading ? (
                    <div style={{ color: "#1d4ed8", fontWeight: 800, fontSize: 12 }}>
                      Uploading {imageUploadName || "image"}... {imageUploadProgress}%
                    </div>
                  ) : null}
                  {imageUploadError ? (
                    <div style={{ color: "#b91c1c", fontWeight: 800, fontSize: 12 }}>{imageUploadError}</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn-flat" onClick={() => void uploadImage()} disabled={imageUploading || !imageUploadFile}>
                      {imageUploading ? "Uploading..." : "Upload Image"}
                    </button>
                    <button
                      type="button"
                      className="btn-flat"
                      onClick={() => {
                        setImageUploadFile(null);
                        setImageUploadName("");
                        setImageUploadProgress(0);
                        setImageUploadError("");
                        if (imageInputRef.current) imageInputRef.current.value = "";
                      }}
                      disabled={imageUploading}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
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
