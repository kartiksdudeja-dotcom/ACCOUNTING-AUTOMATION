import { useEffect, useState } from "react";
import { Pencil, RefreshCw, Search, X } from "lucide-react";
import "./Owners.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const emptyOwner = { unit_no: "", unit_type: "Shop", new_owner: "", old_owner: "", carpet_area: "", mobile: "", email: "", status: "Active" };
const fields = [
  ["unit_no", "Unit number"], ["unit_type", "Unit type"], ["new_owner", "Current owner name"],
  ["old_owner", "Previous owner name"], ["carpet_area", "Carpet area"], ["mobile", "Phone number"],
  ["email", "Email address"], ["status", "Owner status"],
];

export default function Owners({ showToast }) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyOwner);
  const [saving, setSaving] = useState(false);

  const loadOwners = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/members`);
      if (!response.ok) throw new Error("Could not load owners");
      setOwners(await response.json());
    } catch (error) {
      showToast(error.message || "Could not load owners", "error");
    } finally { setLoading(false); }
  };
  useEffect(() => { loadOwners(); }, []);

  const openEdit = (owner) => {
    setEditing(owner);
    setForm(Object.fromEntries(fields.map(([key]) => [key, owner[key] ?? ""])));
  };
  const saveOwner = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/members/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || result.message === "Member Not Found") throw new Error(result.detail || "Owner could not be updated");
      showToast("Owner details updated");
      setEditing(null);
      await loadOwners();
    } catch (error) { showToast(error.message || "Owner could not be updated", "error"); }
    finally { setSaving(false); }
  };
  const filteredOwners = owners.filter((owner) => `${owner.unit_no || ""} ${owner.new_owner || ""} ${owner.old_owner || ""} ${owner.email || ""} ${owner.mobile || ""}`.toLowerCase().includes(query.toLowerCase()));

  return <section className="owners-page">
    <div className="owners-toolbar glass-panel"><div><h2>Owner directory</h2><p>Update unit and contact details used by payment reminders.</p></div><div className="owners-controls"><div className="owners-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search owners or units" /></div><button className="owners-refresh" onClick={loadOwners} disabled={loading}><RefreshCw size={15} /> Refresh</button></div></div>
    <div className="owners-table-panel glass-panel"><div className="table-container">{loading ? <div className="owners-empty">Loading owners…</div> : filteredOwners.length === 0 ? <div className="owners-empty">No owners found.</div> : <table className="glass-table"><thead><tr><th>Unit</th><th>Current owner</th><th>Previous owner</th><th>Phone</th><th>Email</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredOwners.map((owner) => <tr key={owner.id}><td><strong>{owner.unit_no}</strong></td><td>{owner.new_owner || "—"}</td><td>{owner.old_owner || "—"}</td><td>{owner.mobile || "—"}</td><td>{owner.email || "—"}</td><td>{owner.unit_type || "—"}</td><td>{owner.status || "—"}</td><td><button className="owner-edit-button" onClick={() => openEdit(owner)}><Pencil size={14} /> Edit details</button></td></tr>)}</tbody></table>}</div></div>
    {editing && <div className="owner-modal-backdrop" onClick={() => setEditing(null)}><form className="owner-edit-modal" onSubmit={saveOwner} onClick={(event) => event.stopPropagation()}><header><div><h3>Edit owner details</h3><p>Unit {editing.unit_no}</p></div><button type="button" onClick={() => setEditing(null)} aria-label="Close"><X size={18} /></button></header><div className="owner-form-grid">{fields.map(([key, label]) => <label key={key}>{label}{key === "unit_type" || key === "status" ? <select value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>{(key === "unit_type" ? ["Shop", "Office"] : ["Active", "Inactive"]).map((value) => <option key={value}>{value}</option>)}</select> : <input type={key === "email" ? "email" : "text"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>)}</div><footer><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save owner details"}</button></footer></form></div>}
  </section>;
}
