import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  Users,
  DollarSign,
  Search,
  Trash2,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Download,
  Building,
  PiggyBank,
  UploadCloud,
  FileText,
  Bell,
  ContactRound,
} from "lucide-react";
import Documents from "./Documents";
import AIAccounting from "./AIAccounting";
import Reminders from "./Reminders";
import Owners from "./Owners";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  // Page: welcome, app
  const [page, setPage] = useState("welcome");

  // Members
  const [members, setMembers] = useState([]);
  const [memberStats, setMemberStats] = useState({ total: 0 });

  // Accounting data
  const [charges, setCharges] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [ownerExtras, setOwnerExtras] = useState([]);
  const [accountsStats, setAccountsStats] = useState({});

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTab, setCurrentTab] = useState("members");
  const [accountingSubTab, setAccountingSubTab] = useState("charges");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const tabConfig = {
    members: {
      title: "Members Directory",
      subtitle: "Manage all unit owners",
    },
    collections: {
      title: "Collections",
      subtitle: "View monthly collections & owner extras",
    },
    analytics: {
      title: "Financial Analytics",
      subtitle: "View summaries & reports",
    },
    accounting: {
      title: "Accounting",
      subtitle: "Manage expenses and carry-forward balances",
    },
    reminders: {
      title: "Payment Reminders",
      subtitle: "Check bank statement matches and follow up on unpaid owners",
    },
    owners: {
      title: "Owner Details",
      subtitle: "Review and update owner contact and unit information",
    },
  };

  // Toast
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const showToast = (message, type = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  // ==================== FETCHERS ====================
  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      } else {
        showToast("Failed to fetch members", "error");
      }
    } catch (err) {
      console.error("Error fetching members:", err);
      showToast("Network error fetching members", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setMemberStats(data);
      }
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    }
  };

  const fetchCharges = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/charges`);
      if (res.ok) setCharges(await res.json());
    } catch (err) {
      console.error("Error fetching charges:", err);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/expenses`);
      if (res.ok) setExpenses(await res.json());
    } catch (err) {
      console.error("Error fetching expenses:", err);
    }
  };

  const fetchOwnerExtras = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/owner_extras`);
      if (res.ok) setOwnerExtras(await res.json());
    } catch (err) {
      console.error("Error fetching owner extras:", err);
    }
  };

  const fetchAccountsStats = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/dashboard`);
      if (res.ok) setAccountsStats(await res.json());
    } catch (err) {
      console.error("Error fetching accounts stats:", err);
    }
  };

  // ==================== COMPUTED DATA ====================
  const filteredCharges = useMemo(() => {
    if (!selectedMonth || !selectedYear) return [];

    return charges.filter((c) => {
      if (c.charge_month) {
        const [m, y] = c.charge_month.split("_");
        return m === selectedMonth && y === String(selectedYear);
      }
      if (c.date) {
        const d = new Date(c.date);
        return (
          d.getMonth() === monthNameToIndex(selectedMonth) &&
          d.getFullYear() === Number(selectedYear)
        );
      }
      return false;
    });
  }, [selectedMonth, selectedYear, charges]);

  const filteredOwnerExtras = useMemo(() => {
    if (!selectedMonth || !selectedYear) return [];

    return ownerExtras.filter((o) => {
      if (o.date) {
        const d = new Date(o.date);
        return (
          d.getMonth() === monthNameToIndex(selectedMonth) &&
          d.getFullYear() === Number(selectedYear)
        );
      }
      return false;
    });
  }, [selectedMonth, selectedYear, ownerExtras]);

  const filteredExpenses = useMemo(() => {
    if (!selectedMonth || !selectedYear) return [];

    return expenses.filter((e) => {
      if (e.date) {
        const d = new Date(e.date);
        return (
          d.getMonth() === monthNameToIndex(selectedMonth) &&
          d.getFullYear() === Number(selectedYear)
        );
      }
      return false;
    });
  }, [selectedMonth, selectedYear, expenses]);

  const monthlySummary = useMemo(() => {
    if (!selectedMonth || !selectedYear) return null;

    const opening = Number(accountsStats.carry_forward || 0);
    const totalPaid = filteredCharges.reduce(
      (s, c) => s + (Number(c.paid_amount) || 0),
      0,
    );
    const totalOwnerExtra = filteredOwnerExtras.reduce(
      (s, o) => s + (Number(o.amount) || 0),
      0,
    );
    const totalExpenses = filteredExpenses.reduce(
      (s, e) => s + (Number(e.amount) || 0),
      0,
    );
    const closing = opening + totalPaid + totalOwnerExtra - totalExpenses;

    return {
      openingBalance: opening,
      total_collection: totalPaid,
      owner_extra: totalOwnerExtra,
      total_expenses: totalExpenses,
      closingBalance: closing,
    };
  }, [
    selectedMonth,
    selectedYear,
    accountsStats,
    filteredCharges,
    filteredOwnerExtras,
    filteredExpenses,
  ]);

  // ==================== HELPERS ====================
  function monthNameToIndex(name) {
    return [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ].indexOf(name);
  }

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const years = Array.from(
    { length: 6 },
    (_, i) => new Date().getFullYear() - 2 + i,
  );

  // ==================== HANDLERS ====================
  const handleSearch = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      fetchMembers();
      return;
    }
    try {
      const res = await fetch(
        `${API_URL}/members/search/${encodeURIComponent(val)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.message === "Member Not Found") {
          const filtered = members.filter(
            (m) =>
              m.unit_no.toLowerCase().includes(val.toLowerCase()) ||
              (m.new_owner &&
                m.new_owner.toLowerCase().includes(val.toLowerCase())),
          );
          setMembers(filtered);
        } else {
          setMembers([data]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMember = async (id) => {
    if (!confirm("Delete this member?")) return;
    try {
      const res = await fetch(`${API_URL}/members/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Member deleted", "success");
        fetchMembers();
      } else {
        showToast("Failed to delete", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error deleting member", "error");
    }
  };

  // Initial load when entering app page
  useEffect(() => {
    if (page === "app") {
      const loadAppData = async () => {
        await Promise.all([
          fetchDashboardStats(),
          fetchMembers(),
          fetchCharges(),
          fetchExpenses(),
          fetchOwnerExtras(),
          fetchAccountsStats(),
        ]);
      };
      loadAppData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ==================== WELCOME PAGE ====================
  if (page === "welcome") {
    return (
      <div className="welcome-container">
        <div className="welcome-panel">
          <div className="welcome-logo">
            <div className="logo-glow">
              <Building size={28} />
            </div>
          </div>
          <h1 className="welcome-title">SocietyMorph</h1>
          <p className="welcome-subtitle">
            Next-Gen Society Management Suite. Manage members, track
            collections, and maintain financial records with ease.
          </p>

          <div className="features-preview">
            <div className="feature-mini-card">
              <h3>
                <Users size={16} /> Members
              </h3>
              <p>Manage all unit owners and their details</p>
            </div>
            <div className="feature-mini-card">
              <h3>
                <DollarSign size={16} /> Collections
              </h3>
              <p>Track monthly collections & owner extras</p>
            </div>
            <div className="feature-mini-card">
              <h3>
                <TrendingUp size={16} /> Analytics
              </h3>
              <p>View financial summaries & reports</p>
            </div>
            <div className="feature-mini-card">
              <h3>
                <PiggyBank size={16} /> Accounting
              </h3>
              <p>Manage expenses and carry-forward balances</p>
            </div>
          </div>

          <button
            onClick={() => setPage("app")}
            style={{
              padding: "12px 32px",
              background:
                "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "24px",
              boxShadow: "0 8px 20px rgba(139, 92, 246, 0.3)",
            }}
          >
            Enter Dashboard{" "}
            <ChevronRight
              size={16}
              style={{ marginLeft: "8px", display: "inline" }}
            />
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN APP PAGE ====================
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Building size={20} style={{ color: "var(--primary)" }} />
          <span className="brand-text">SocietyMorph</span>
        </div>
        <nav className="sidebar-menu">
          <div className="menu-label">Main Menu</div>
          <button
            onClick={() => setCurrentTab("members")}
            className={`menu-item ${currentTab === "members" ? "active" : ""}`}
          >
            <Users size={18} /> Members
          </button>
          <button
            onClick={() => {
              setCurrentTab("accounting");
              setAccountingSubTab("expenses");
            }}
            className={`menu-item ${currentTab === "accounting" ? "active" : ""}`}
          >
            <PiggyBank size={18} /> Accounting
          </button>
          <button
            onClick={() => setCurrentTab("documents")}
            className={`menu-item ${currentTab === "documents" ? "active" : ""}`}
          >
            <FileText size={18} /> Documents
          </button>
          <button
            onClick={() => setCurrentTab("bank")}
            className={`menu-item ${currentTab === "bank" ? "active" : ""}`}
          >
            <UploadCloud size={18} /> Bank Upload
          </button>
          <button
            onClick={() => setCurrentTab("reminders")}
            className={`menu-item ${currentTab === "reminders" ? "active" : ""}`}
          >
            <Bell size={18} /> Reminders
          </button>
          <button
            onClick={() => setCurrentTab("owners")}
            className={`menu-item ${currentTab === "owners" ? "active" : ""}`}
          >
            <ContactRound size={18} /> Owner Details
          </button>
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => setPage("welcome")}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              color: "var(--text-muted)",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            ← Back to Welcome
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-panel">
        <div className="main-header">
          <div className="header-title">
            <h1>{tabConfig[currentTab]?.title || "SocietyMorph"}</h1>
            <p>
              {tabConfig[currentTab]?.subtitle ||
                "Manage your society operations"}
            </p>
          </div>
        </div>

        {/* ==================== MEMBERS TAB ==================== */}
        {currentTab === "members" && (
          <>
            {/* Dashboard Stats */}
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-glow-bg"></div>
                <div className="stat-icon">
                  <Users size={24} />
                </div>
                <div className="stat-value">{memberStats.total || 0}</div>
                <div className="stat-label">Total Members</div>
              </div>
              <div className="stat-card success">
                <div className="stat-glow-bg"></div>
                <div className="stat-icon">
                  <TrendingUp size={24} />
                </div>
                <div className="stat-value">
                  ₹
                  {
                    (accountsStats.total_collection || 0)
                      .toLocaleString("en-IN")
                      .split(".")[0]
                  }
                </div>
                <div className="stat-label">Total Collections</div>
              </div>
              <div className="stat-card accent">
                <div className="stat-glow-bg"></div>
                <div className="stat-icon">
                  <TrendingDown size={24} />
                </div>
                <div className="stat-value">
                  ₹
                  {
                    (accountsStats.total_expenses || 0)
                      .toLocaleString("en-IN")
                      .split(".")[0]
                  }
                </div>
                <div className="stat-label">Total Expenses</div>
              </div>
              <div className="stat-card secondary">
                <div className="stat-glow-bg"></div>
                <div className="stat-icon">
                  <DollarSign size={24} />
                </div>
                <div className="stat-value">
                  ₹
                  {
                    (accountsStats.carry_forward || 0)
                      .toLocaleString("en-IN")
                      .split(".")[0]
                  }
                </div>
                <div className="stat-label">Carry Forward</div>
              </div>
            </div>

            {/* Members Search & Table */}
            <div className="content-toolbar">
              <div className="search-container">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search members by unit or name..."
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
            </div>

            <div className="glass-panel">
              <div className="table-container">
                {isLoading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "32px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Loading members...
                  </div>
                ) : members.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "32px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No members found
                  </div>
                ) : (
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Unit No</th>
                        <th>Type</th>
                        <th>Owner</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th style={{ textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.slice(0, 50).map((member) => (
                        <tr key={member.id}>
                          <td style={{ fontWeight: 700, color: "white" }}>
                            {member.unit_no}
                          </td>
                          <td>
                            <span
                              className={`tag tag-${
                                member.unit_type === "Office"
                                  ? "office"
                                  : "shop"
                              }`}
                            >
                              {member.unit_type}
                            </span>
                          </td>
                          <td>{member.new_owner || member.old_owner}</td>
                          <td>{member.mobile || member.email || "-"}</td>
                          <td>
                            <span
                              className={`tag tag-${
                                member.status === "Active"
                                  ? "active"
                                  : "inactive"
                              }`}
                            >
                              {member.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={() => handleDeleteMember(member.id)}
                              className="icon-btn delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* ==================== ACCOUNTING TAB ==================== */}
        {currentTab === "accounting" && (
          <>
            {/* Tab Buttons */}
            <div className="content-toolbar">
              <div className="toolbar-tabs">
                <button
                  onClick={() => setAccountingSubTab("charges")}
                  className={`tab-btn ${accountingSubTab === "charges" ? "active" : ""}`}
                >
                  Collections
                </button>
                <button
                  onClick={() => setAccountingSubTab("expenses")}
                  className={`tab-btn ${accountingSubTab === "expenses" ? "active" : ""}`}
                >
                  Expenses
                </button>
                <button
                  onClick={() => setAccountingSubTab("summary")}
                  className={`tab-btn ${accountingSubTab === "summary" ? "active" : ""}`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setAccountingSubTab("reports")}
                  className={`tab-btn ${accountingSubTab === "reports" ? "active" : ""}`}
                >
                  Reports
                </button>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="search-input"
                  style={{ flex: 1, maxWidth: "160px" }}
                >
                  <option value="">Month</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="search-input"
                  style={{ flex: 1, maxWidth: "120px" }}
                >
                  <option value="">Year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tables */}
            <div className="glass-panel">
              <div className="table-container">
                {/* Collections */}
                {accountingSubTab === "charges" && (
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Unit No</th>
                        <th>Billing Month</th>
                        <th>Required Amount</th>
                        <th>Paid Amount</th>
                        <th>Owner Extra</th>
                        <th>Outstanding Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedMonth || !selectedYear ? (
                        <tr>
                          <td
                            colSpan="7"
                            style={{
                              textAlign: "center",
                              padding: "32px",
                              color: "var(--text-muted)",
                            }}
                          >
                            Select a month and year to view collections
                          </td>
                        </tr>
                      ) : filteredCharges.length === 0 ? (
                        <tr>
                          <td
                            colSpan="7"
                            style={{
                              textAlign: "center",
                              padding: "32px",
                              color: "var(--text-muted)",
                            }}
                          >
                            No charge records for selected month
                          </td>
                        </tr>
                      ) : (
                        filteredCharges.slice(0, 100).map((charge) => {
                          const ownerExtra = filteredOwnerExtras.reduce(
                            (s, o) =>
                              o.unit_no === charge.unit_no
                                ? s + (Number(o.amount) || 0)
                                : s,
                            0,
                          );
                          const outstanding =
                            (Number(charge.amount) || 0) -
                            (Number(charge.paid_amount) || 0);
                          const status =
                            (Number(charge.paid_amount) || 0) >=
                            (Number(charge.amount) || 0)
                              ? "Fully Paid"
                              : (Number(charge.paid_amount) || 0) > 0
                                ? "Partial"
                                : "Due";
                          return (
                            <tr key={charge.id}>
                              <td style={{ fontWeight: 700, color: "white" }}>
                                {charge.unit_no}
                              </td>
                              <td>
                                {charge.charge_month
                                  ? charge.charge_month.replace("_", " ")
                                  : charge.date}
                              </td>
                              <td>
                                ₹{" "}
                                {(Number(charge.amount) || 0).toLocaleString(
                                  "en-IN",
                                )}
                              </td>
                              <td
                                style={{
                                  color: "var(--success)",
                                  fontWeight: 600,
                                }}
                              >
                                ₹{" "}
                                {(
                                  Number(charge.paid_amount) || 0
                                ).toLocaleString("en-IN")}
                              </td>
                              <td>₹ {ownerExtra.toLocaleString("en-IN")}</td>
                              <td
                                style={{
                                  color:
                                    outstanding > 0
                                      ? "var(--warning)"
                                      : "var(--text-muted)",
                                }}
                              >
                                ₹ {outstanding.toLocaleString("en-IN")}
                              </td>
                              <td>
                                <span
                                  className={`tag tag-${
                                    status === "Fully Paid"
                                      ? "paid"
                                      : status === "Partial"
                                        ? "active"
                                        : "due"
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* Expenses */}
                {accountingSubTab === "expenses" && (
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedMonth || !selectedYear ? (
                        <tr>
                          <td
                            colSpan="4"
                            style={{
                              textAlign: "center",
                              padding: "32px",
                              color: "var(--text-muted)",
                            }}
                          >
                            Select a month and year
                          </td>
                        </tr>
                      ) : filteredExpenses.length === 0 ? (
                        <tr>
                          <td
                            colSpan="4"
                            style={{
                              textAlign: "center",
                              padding: "32px",
                              color: "var(--text-muted)",
                            }}
                          >
                            No expenses for this month
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((e) => (
                          <tr key={e.id}>
                            <td>{e.date}</td>
                            <td>{e.category || "Expense"}</td>
                            <td>
                              ₹{" "}
                              {(Number(e.amount) || 0).toLocaleString("en-IN")}
                            </td>
                            <td>{e.remarks || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {/* Summary */}
                {accountingSubTab === "summary" && (
                  <div style={{ padding: "24px" }}>
                    {!monthlySummary ? (
                      <div
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: "32px",
                        }}
                      >
                        Select month & year to view summary
                      </div>
                    ) : (
                      <div style={{ maxWidth: "500px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "12px 0",
                            borderBottom: "1px solid var(--border-glass)",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>
                            Opening Balance
                          </span>
                          <span>
                            ₹{" "}
                            {monthlySummary.openingBalance.toLocaleString(
                              "en-IN",
                            )}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "12px 0",
                            borderBottom: "1px solid var(--border-glass)",
                          }}
                        >
                          <span>Total Paid Amount</span>
                          <span>
                            ₹{" "}
                            {monthlySummary.total_collection.toLocaleString(
                              "en-IN",
                            )}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "12px 0",
                            borderBottom: "1px solid var(--border-glass)",
                          }}
                        >
                          <span>Total Owner Extra</span>
                          <span>
                            ₹{" "}
                            {monthlySummary.owner_extra.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "12px 0",
                            borderBottom: "1px solid var(--border-glass)",
                          }}
                        >
                          <span>Total Expenses</span>
                          <span>
                            ₹{" "}
                            {monthlySummary.total_expenses.toLocaleString(
                              "en-IN",
                            )}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "12px 0",
                            fontWeight: 800,
                            fontSize: "16px",
                            color: "var(--success)",
                          }}
                        >
                          <span>Closing Balance</span>
                          <span>
                            ₹{" "}
                            {monthlySummary.closingBalance.toLocaleString(
                              "en-IN",
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reports */}
                {accountingSubTab === "reports" && (
                  <div style={{ padding: "24px" }}>
                    <button
                      style={{
                        padding: "12px 24px",
                        background: "var(--primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      <Download
                        size={16}
                        style={{ marginRight: "8px", display: "inline" }}
                      />
                      Download Report
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {currentTab === "documents" && <Documents showToast={showToast} />}
        {currentTab === "bank" && <AIAccounting showToast={showToast} />}
        {currentTab === "reminders" && <Reminders showToast={showToast} />}
        {currentTab === "owners" && <Owners showToast={showToast} />}
      </main>

      {/* Toast Notifications */}
      <div className="toasts-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
