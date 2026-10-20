import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Mail, MessageCircle, CheckCircle, AlertCircle, Search, Pencil, X } from "lucide-react";
import "./Reminders.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function Reminders({ showToast }) {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [drafts, setDrafts] = useState({});
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");

  const loadStatus = useCallback(async (requestedMonth = month) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/bank/monthly-status?month=${requestedMonth}`);
      const data = await response.json();
      if (!response.ok) {
        setReport(null);
        if (response.status !== 404) throw new Error(data.detail || "Could not load payment status");
        return;
      }
      setReport(data);
      setSelected([]);
    } catch (error) {
      showToast(error.message || "Could not connect to bank status", "error");
    } finally {
      setLoading(false);
    }
  }, [month, showToast]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const rows = report?.data || [];
  const hasStatement = Boolean(report?.maintenance_transactions > 0);
  const unpaid = rows.filter((row) => row.status === "UNPAID");
  const visibleRows = useMemo(() => rows.filter((row) =>
    (statusFilter === "ALL" || row.status === statusFilter) &&
    `${row.owner_name || ""} ${row.unit_no || ""} ${row.email || ""} ${row.mobile || ""}`.toLowerCase().includes(query.toLowerCase())
  ), [rows, query, statusFilter]);

  const toggle = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const selectableUnpaid = visibleRows.filter((row) => row.status === "UNPAID");
  const toggleVisible = () => {
    const ids = selectableUnpaid.map((row) => row.member_id);
    setSelected((items) => ids.every((id) => items.includes(id)) ? items.filter((id) => !ids.includes(id)) : [...new Set([...items, ...ids])]);
  };

  const sendEmail = async () => {
    if (!selected.length) return showToast("Select unpaid owners first", "error");
    setSending(true);
    try {
      const response = await fetch(`${API_URL}/reminders/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, member_ids: selected, channel: "email", messages: drafts }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Email reminders could not be sent");
      const sent = data.results?.filter((result) => result.status === "SENT").length || 0;
      const skipped = data.results?.filter((result) => result.status === "SKIPPED").length || 0;
      const failed = data.results?.filter((result) => result.status === "FAILED").length || 0;
      showToast(`Email reminders: ${sent} sent${skipped ? `, ${skipped} already paid` : ""}${failed ? `, ${failed} failed` : ""}`, failed ? "error" : "success");
      await loadStatus(month);
    } catch (error) {
      showToast(error.message || "Email reminders could not be sent", "error");
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = (row) => {
    if (!row.mobile) return showToast(`No phone number for ${row.owner_name || `unit ${row.unit_no}`}`, "error");
    const phone = row.mobile.replace(/\D/g, "");
    const message = (drafts[row.member_id] || `Hello {owner_name}, this is a reminder that maintenance payment for unit {unit_no} for {month} has not been found in the bank statement. If you have paid, please share the payment details. Thank you.`)
      .replaceAll("{owner_name}", row.owner_name || "Owner").replaceAll("{unit_no}", row.unit_no || "").replaceAll("{month}", month);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const openSelectedWhatsApp = () => {
    const row = unpaid.find((item) => item.member_id === selected[0]);
    if (!row) return showToast("Select an unpaid owner first", "error");
    openWhatsApp(row);
  };

  const defaultMessage = (row) => `Hello {owner_name}, this is a reminder that maintenance payment for unit {unit_no} for {month} has not been found in the bank statement. If you have paid, please share the payment details. Thank you.`;
  const saveMessage = () => {
    setDrafts((current) => ({ ...current, [editing.member_id]: editText }));
    setEditing(null);
  };

  return (
    <section className="reminders-page">
      <div className="reminders-toolbar glass-panel">
        <div className="reminder-month">
          <label htmlFor="reminder-month">Statement month</label>
          <input id="reminder-month" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setSelected([]); }} />
        </div>
        <div className={`statement-status ${hasStatement ? "connected" : "disconnected"}`}>
          {hasStatement ? <CheckCircle size={17} /> : <AlertCircle size={17} />}
          <span>{hasStatement ? `Bank statement connected · ${report.maintenance_transactions} maintenance entries` : "No maintenance entries found for this month"}</span>
        </div>
        <button className="reminder-refresh" onClick={() => loadStatus(month)} disabled={loading} aria-label="Refresh bank status"><RefreshCw size={16} className={loading ? "is-spinning" : ""} /> Refresh</button>
      </div>

      <div className="reminder-stats">
        <div className="reminder-stat"><span>Owners checked</span><strong>{report?.total_members ?? "—"}</strong></div>
        <div className="reminder-stat paid"><span>Paid</span><strong>{report?.paid_count ?? "—"}</strong></div>
        <div className="reminder-stat unpaid"><span>Unpaid</span><strong>{report?.unpaid_count ?? "—"}</strong></div>
      </div>

      <div className="reminders-list-panel glass-panel">
        <div className="reminders-list-header">
          <div><h2>Owner payment status</h2><p>Payment matches are based on the uploaded bank statement.</p></div>
          <div className="reminder-actions">
            <select className="reminder-filter" aria-label="Filter by payment status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></select>
            <div className="reminder-search"><Search size={15} /><input placeholder="Find owner or unit" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <button className="reminder-action email" onClick={sendEmail} disabled={sending || !selected.length || !hasStatement}><Mail size={15} /> {sending ? "Sending…" : "Send email"}</button>
            <button className="reminder-action whatsapp" onClick={openSelectedWhatsApp} disabled={!selected.length || !hasStatement}><MessageCircle size={15} /> WhatsApp</button>
          </div>
        </div>
        <div className="reminders-table-wrap">
          {loading ? <div className="reminders-empty">Checking uploaded bank statement…</div> : !report ? <div className="reminders-empty">Upload and process a bank statement in Bank Upload, then refresh this list.</div> : visibleRows.length === 0 ? <div className="reminders-empty">No owners match this search.</div> : (
            <table className="glass-table reminders-table">
              <thead><tr><th><input type="checkbox" aria-label="Select visible unpaid owners" checked={selectableUnpaid.length > 0 && selectableUnpaid.every((row) => selected.includes(row.member_id))} onChange={toggleVisible} /></th><th>Owner / Unit</th><th>Phone</th><th>Email</th><th>Bank match</th><th>Payment</th><th>Message</th><th>Action</th></tr></thead>
              <tbody>{visibleRows.map((row) => <tr key={row.member_id}>
                <td><input type="checkbox" aria-label={`Select ${row.owner_name || row.unit_no}`} disabled={row.status !== "UNPAID" || !hasStatement} checked={selected.includes(row.member_id)} onChange={() => toggle(row.member_id)} /></td>
                <td><strong>{row.owner_name || "Owner not listed"}</strong><small>Unit {row.unit_no} · {row.unit_type || "—"}</small></td>
                <td>{row.mobile || "—"}</td><td>{row.email || "—"}</td>
                <td>{row.status === "PAID" ? <span className="payment-detail">Matched {row.matched_by} · ₹{Number(row.paid_amount || 0).toLocaleString("en-IN")}</span> : <span className="payment-detail muted">No matching entry</span>}</td>
                <td><span className={`payment-badge ${row.status === "PAID" ? "is-paid" : "is-unpaid"}`}>{row.status}</span></td>
                <td>{row.status === "UNPAID" && <button className="edit-message-button" onClick={() => { setEditing(row); setEditText(drafts[row.member_id] || defaultMessage(row)); }}><Pencil size={13} /> Edit message</button>}</td>
                <td>{row.status === "UNPAID" && hasStatement && <button className="row-whatsapp" title="Open WhatsApp reminder" onClick={() => openWhatsApp(row)}><MessageCircle size={16} /></button>}</td>
              </tr>)}</tbody>
            </table>
          )}
        </div>
        <div className="reminder-list-footer">{selected.length} unpaid owner{selected.length === 1 ? "" : "s"} selected{unpaid.length > 0 ? ` · ${unpaid.length} unpaid total` : ""}</div>
      </div>
      {editing && <div className="reminder-modal-backdrop" onClick={() => setEditing(null)}><div className="reminder-message-modal" role="dialog" aria-modal="true" aria-labelledby="edit-reminder-title" onClick={(event) => event.stopPropagation()}><div className="message-modal-title"><div><h3 id="edit-reminder-title">Edit reminder message</h3><p>Use {"{owner_name}"}, {"{unit_no}"}, and {"{month}"} for owner details.</p></div><button onClick={() => setEditing(null)} aria-label="Close"><X size={18} /></button></div><textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={7} /><div className="message-modal-actions"><button onClick={() => setEditing(null)}>Cancel</button><button onClick={saveMessage}>Save message</button></div></div></div>}
    </section>
  );
}
