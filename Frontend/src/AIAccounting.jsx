import { useState, useEffect, useRef } from "react";
import {
  Brain,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  FileSpreadsheet,
  Edit3,
  X,
  Zap,
  RefreshCw,
  Receipt,
  PlusCircle,
  Trash2,
  ChevronRight,
  Database,
  Filter,
  TrendingUp,
  TrendingDown,
  Download,
} from "lucide-react";
import "./AIAccounting.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AIAccounting({ showToast }) {
  const [activeTab, setActiveTab] = useState("transactions");
  const [transactions, setTransactions] = useState([]);
  const [reviewTxs, setReviewTxs] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [members, setMembers] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");

  // Edit modal
  const [editingTx, setEditingTx] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editUnits, setEditUnits] = useState([]); // Array of strings e.g. ["201", "202", "209"]
  const [editUnitInput, setEditUnitInput] = useState(""); // Raw typing input
  const [editOwner, setEditOwner] = useState("");
  const [editUnitDropdownOpen, setEditUnitDropdownOpen] = useState(false);
  const [editUnitSearch, setEditUnitSearch] = useState("");

  // Train AI modal
  const [isTrainModalOpen, setIsTrainModalOpen] = useState(false);
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [trainKeyword, setTrainKeyword] = useState("");
  const [trainOnSave, setTrainOnSave] = useState(false);
  const [trainKeywordEdit, setTrainKeywordEdit] = useState("");
  const [trainUnit, setTrainUnit] = useState([]); // Array for multi-select
  const [trainCategory, setTrainCategory] = useState("MAINTENANCE");
  const [trainFromTx, setTrainFromTx] = useState(null);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState("");

  const fileInputRef = useRef(null);
  const unitDropdownRef = useRef(null);
  const editUnitDropdownRef = useRef(null);

  useEffect(() => {
    fetchTransactions();
    fetchMembers();
  }, []);

  // Close unit dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        unitDropdownRef.current &&
        !unitDropdownRef.current.contains(e.target)
      ) {
        setUnitDropdownOpen(false);
      }
      if (
        editUnitDropdownRef.current &&
        !editUnitDropdownRef.current.contains(e.target)
      ) {
        setEditUnitDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeTab === "transactions") fetchTransactions();
    if (activeTab === "review") fetchReview();
    if (activeTab === "training") fetchTrainings();
    if (activeTab === "vouchers") fetchVouchers();
  }, [activeTab]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bank/transactions`);
      if (res.ok) setTransactions(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReview = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bank/review`);
      if (res.ok) setReviewTxs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrainings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bank/training`);
      if (res.ok) setTrainings(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVouchers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/expenses/vouchers`);
      if (res.ok) setVouchers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_URL}/members`);
      if (res.ok) setMembers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshAll = () => {
    showToast("Refreshing all data...");
    fetchTransactions();
    fetchReview();
    fetchTrainings();
    fetchVouchers();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bank/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Uploaded ${data.imported_transactions} new transactions!`);
        handleRefreshAll();
      } else showToast("Upload failed", "error");
    } catch {
      showToast("Error uploading statement", "error");
    } finally {
      setIsLoading(false);
      e.target.value = null;
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        "WARNING: This will delete ALL transactions and vouchers. Are you sure?",
      )
    )
      return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bank/clear`, { method: "DELETE" });
      if (res.ok) {
        showToast("All data cleared successfully");
        handleRefreshAll();
      } else showToast("Failed to clear data", "error");
    } catch {
      showToast("Error clearing data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessAI = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_URL}/bank/process`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast(
          `AI: ${data.maintenance_detected} Maintenance, ${data.expense_detected} Expenses, ${data.review_required} Review`,
        );
        handleRefreshAll();
      } else showToast("AI Processing failed", "error");
    } catch {
      showToast("Error running AI", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitToAccounting = async () => {
    if (stats.review > 0) {
      showToast("Please review all transactions first", "error");
      return;
    }

    if (
      !window.confirm(
        "This will post all verified transactions to the main accounting ledgers. Continue?",
      )
    )
      return;

    setIsProcessing(true);
    try {
      const res = await fetch(`${API_URL}/bank/submit`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast(
          `Success: ${data.maintenance_processed} Maint, ${data.sinking_processed} Sinking, ${data.expense_vouchers_created} Expenses posted!`,
        );
        handleRefreshAll();
      } else showToast("Failed to submit to accounting", "error");
    } catch {
      showToast("Error submitting to accounting", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const extractKeyword = (narration) => {
    const nStr = String(narration || "").trim();
    const GENERIC_PREFIXES = ["UPI", "NEFT", "RTGS", "IMPS", "POS", "ACH", "INB", "MB", "MMT", "REV", "DR", "CR", "TRANSFER", "PAYMENT", "CHQ", "CHEQUE"];

    // Split by common delimiters
    const parts = nStr.split(/[-/]/);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      const pUpper = p.toUpperCase();
      // Skip generic bank prefixes, empty, numeric, or UPI handles (e.g. name@okaxis)
      if (!p || p.length < 3 || GENERIC_PREFIXES.includes(pUpper) || /^\d+$/.test(p) || p.includes("@") || /^[A-Z0-9]{8,}$/.test(p)) {
        continue;
      }
      // Return meaningful name segment (up to 2 words, or first full name)
      const words = p.split(/\s+/).filter(w => w.length >= 2 && !GENERIC_PREFIXES.includes(w.toUpperCase()));
      if (words.length > 0) {
        return words.slice(0, 2).join(" ");
      }
    }
    return "";
  };

  const extractDrawnOn = (narration) => {
    const n = String(narration || "").trim();
    if (!n) return "—";
    const parts = n.split("-");
    if (n.toUpperCase().startsWith("UPI-") && parts.length > 1) {
      const clean = parts[1].replace(/[\d@].*$/, "").trim();
      return clean.length >= 3 ? clean : parts[1].trim();
    }
    if (parts.length > 1) return parts[1].trim();
    return parts[0] || "—";
  };

  const extractParticulars = (narration) => {
    const n = String(narration || "").trim();
    if (!n) return "—";
    const KNOWN = {
      "WATER TANKER": "water tanker",
      "TANKER": "water tanker",
      "WACHMAN": "caretaker salary/ garbage",
      "WATCHMAN": "caretaker salary/ garbage",
      "CARETAKER": "caretaker salary/ garbage",
      "GARBAGE": "Garbage Expense",
      "MANAGER": "Manager Salary",
      "LIFT AMC": "LIFT AMC",
      "LIFT": "LIFT AMC",
      "CLEANING": "CLEANING STUFF",
      "MOTOR REPAIR": "MOTOR REPAIR MATERIAL",
      "MOTOR": "MOTOR REPAIR MATERIAL",
      "MOTAR": "MOTOR REPAIR MATERIAL",
      "PUMP RENT": "MOTOR PUMP ON RENT",
      "PUMP": "MOTOR PUMP ON RENT",
      "ELECTRICITY": "ELECTRICITY BILL",
      "BILLPAY": "ELECTRICITY BILL",
      "MSEDCL": "ELECTRICITY BILL",
      "PANEL": "ELECTRICAL PANEL SERVICE",
      "DIESEL": "DIESEL",
      "LETTER": "LETTER HEAD PRINT",
      "AUDIT": "AUDIT FEES",
      "ACCOUNTING": "ACCOUNTING",
      "ADVANCE": "CARETAKER ADVANCE SALARY",
      "SECURITY": "SECURITY CHARGES",
      "CEMENT": "CEMENT / OTHER MATERIAL",
      "PLUMBING": "PLUMBING REPAIR",
      "GARDENING": "GARDEN MAINTENANCE"
    };
    const upper = n.toUpperCase();
    for (const [k, v] of Object.entries(KNOWN)) {
      if (upper.includes(k)) return v;
    }
    const parts = n.split("-");
    if (parts.length >= 3) {
      const last = parts[parts.length - 1].trim();
      if (!/^\d+$/.test(last) && !/^[A-Z0-9]{8,}$/.test(last) && last.toUpperCase() !== "UPI") {
        return last;
      }
    }
    return "Expense";
  };

  const toggleEditUnitSelection = (unitStr) => {
    const u = String(unitStr).trim();
    if (!u) return;
    setEditUnits((prev) => {
      const exists = prev.includes(u);
      let updated;
      if (exists) {
        updated = prev.filter((item) => item !== u);
      } else {
        updated = [...prev, u];
      }
      setEditUnitInput(updated.join(", "));
      // Auto-populate owner name from selected units
      const matchedOwners = updated
        .map(unitVal => members.find(m => String(m.unit_no).trim() === unitVal)?.new_owner)
        .filter(Boolean);
      const uniqueOwners = [...new Set(matchedOwners)];
      if (uniqueOwners.length > 0) {
        setEditOwner(uniqueOwners.join(", "));
      }
      return updated;
    });
  };

  const handleEditUnitRawInputChange = (text) => {
    setEditUnitInput(text);
    const tokens = text
      .split(/[,.\s]+/)
      .map(t => t.trim())
      .filter(Boolean);
    setEditUnits(tokens);
    if (tokens.length > 0) {
      const matchedOwners = tokens
        .map(unitVal => members.find(m => String(m.unit_no).trim() === unitVal)?.new_owner)
        .filter(Boolean);
      const uniqueOwners = [...new Set(matchedOwners)];
      if (uniqueOwners.length > 0) {
        setEditOwner(uniqueOwners.join(", "));
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    try {
      const finalUnitStr = editStatus === "EXPENSE" ? "" : editUnits.join(",");
      let ownerName = editOwner;
      if (!ownerName && editUnits.length > 0) {
        const matchedOwners = editUnits
          .map(u => members.find(m => String(m.unit_no).trim() === u)?.new_owner)
          .filter(Boolean);
        ownerName = [...new Set(matchedOwners)].join(", ") || (editingTx.matched_owner || "");
      }

      const res = await fetch(`${API_URL}/bank/transactions/${editingTx.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: editStatus, 
          matched_unit: finalUnitStr,
          matched_owner: ownerName 
        }),
      });
      if (res.ok) {
        const keyword = extractKeyword(editingTx.narration);
        if (keyword && (finalUnitStr || editStatus === "EXPENSE")) {
          await fetch(`${API_URL}/bank/train`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keyword: keyword,
              category: editStatus,
              unit_no: finalUnitStr,
              owner_name: ownerName
            })
          });
          showToast(`Saved & AI trained: "${keyword}" → ${editStatus === "EXPENSE" ? (ownerName || "EXPENSE") : `Unit ${finalUnitStr}`}`);
        } else {
          showToast("Transaction updated");
        }

        setEditingTx(null);
        fetchTransactions();
        if (activeTab === "review") fetchReview();
        if (editStatus === "EXPENSE") fetchVouchers();
      } else showToast("Failed to update", "error");
    } catch {
      showToast("Error updating", "error");
    }
  };

  const openEditTx = (tx) => {
    setEditingTx(tx);
    setEditStatus(tx.status || (tx.transaction_type === "DEBIT" ? "EXPENSE" : "MAINTENANCE"));
    const rawUnits = tx.matched_unit
      ? String(tx.matched_unit).split(/[,.\s]+/).map(u => u.trim()).filter(Boolean)
      : [];
    setEditUnits(rawUnits);
    setEditUnitInput(rawUnits.join(", "));
    setEditOwner(tx.matched_owner || "");
    setEditUnitDropdownOpen(false);
    setEditUnitSearch("");
    fetchMembers();
  };

  const handleGenerateExpenses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bank/generate-expenses`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast(`Created ${data.expense_vouchers_created} expense vouchers!`);
        fetchVouchers();
      } else {
        showToast("Failed to generate expense vouchers", "error");
      }
    } catch {
      showToast("Error generating expense vouchers", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bank/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Bank_Statement_Export.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast("Excel file exported successfully");
      } else {
        let errorMsg = "Failed to export Excel";
        try {
          const data = await res.json();
          if (data.detail) errorMsg = data.detail;
        } catch (e) { }
        showToast(errorMsg, "error");
      }
    } catch (err) {
      showToast("Error exporting Excel", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrainAI = async () => {
    if (!trainKeyword.trim()) {
      showToast("Keyword is required", "error");
      return;
    }
    try {
      const url = editingTrainingId
        ? `${API_URL}/bank/train/${editingTrainingId}`
        : `${API_URL}/bank/train`;
      const method = editingTrainingId ? "PUT" : "POST";
      const unitStr = Array.isArray(trainUnit)
        ? trainUnit.join(",")
        : trainUnit;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: trainKeyword,
          unit_no: unitStr,
          category: trainCategory,
        }),
      });
      if (res.ok) {
        showToast(
          editingTrainingId
            ? "Training rule updated!"
            : "AI trained successfully!",
        );
        closeTrainModal();
        if (activeTab === "training") fetchTrainings();
        fetchTransactions();
        fetchReview();
      } else showToast("Training failed", "error");
    } catch {
      showToast("Error training AI", "error");
    }
  };

  const handleDeleteTraining = async (id) => {
    if (!window.confirm("Delete this training rule?")) return;
    try {
      const res = await fetch(`${API_URL}/bank/train/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Rule deleted");
        fetchTrainings();
      }
    } catch {
      showToast("Error deleting rule", "error");
    }
  };

  const toggleUnitSelection = (unitNo) => {
    setTrainUnit((prev) => {
      const arr = Array.isArray(prev)
        ? prev
        : prev
          ? prev.split(",").filter(Boolean)
          : [];
      return arr.includes(unitNo)
        ? arr.filter((u) => u !== unitNo)
        : [...arr, unitNo];
    });
  };

  const openTrainFromTx = (tx) => {
    setEditingTrainingId(null);
    setTrainFromTx(tx);
    setTrainKeyword(tx.narration || "");
    setTrainUnit(
      tx.matched_unit ? tx.matched_unit.split(",").filter(Boolean) : [],
    );
    setTrainCategory("MAINTENANCE");
    setIsTrainModalOpen(true);
  };

  const openEditTraining = (t) => {
    setEditingTrainingId(t.id);
    setTrainFromTx(null);
    setTrainKeyword(t.keyword || "");
    setTrainUnit(t.unit_no ? t.unit_no.split(",").filter(Boolean) : []);
    setTrainCategory(t.category || "MAINTENANCE");
    setIsTrainModalOpen(true);
  };

  const closeTrainModal = () => {
    setIsTrainModalOpen(false);
    setEditingTrainingId(null);
    setTrainKeyword("");
    setTrainUnit([]);
    setTrainCategory("MAINTENANCE");
    setTrainFromTx(null);
    setUnitDropdownOpen(false);
    setUnitSearchQuery("");
  };

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return "—";
    return `₹ ${parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr === "string" && dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        let [day, month, year] = parts;
        if (year.length === 2) year = "20" + year;
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (dateStr) => {
    const d = parseDate(dateStr);
    return d
      ? d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      : dateStr || "—";
  };

  const getStatusBadge = (status) => {
    const map = {
      MAINTENANCE: { cls: "success", label: "Maintenance" },
      SINKING_FUND: { cls: "teal", label: "Sinking Fund" },
      EXPENSE: { cls: "primary", label: "Expense" },
      REVIEW: { cls: "warning", label: "Needs Review" },
      PENDING: { cls: "pending", label: "Pending" },
      APPROVED: { cls: "success", label: "Approved" },
    };
    const s = map[status] || { cls: "", label: status };
    return <span className={`ai-badge ${s.cls}`}>{s.label}</span>;
  };

  const stats = {
    total: transactions.length,
    matched: transactions.filter(
      (t) =>
        ["MAINTENANCE", "EXPENSE", "SINKING_FUND"].includes(t.status) &&
        !t.accounting_posted,
    ).length,
    review: transactions.filter((t) => t.status === "REVIEW").length,
    pending: transactions.filter((t) => t.status === "PENDING").length,
    creditAmount: transactions.reduce((sum, t) => {
      if (t.transaction_type && t.transaction_type.toUpperCase() === 'CREDIT') {
        return sum + (Number(t.amount) || 0);
      }
      return sum;
    }, 0),
    debitAmount: transactions.reduce((sum, t) => {
      if (t.transaction_type && t.transaction_type.toUpperCase() === 'DEBIT') {
        return sum + (Number(t.amount) || 0);
      }
      return sum;
    }, 0),
  };

  // Month & Year Filter Options
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const uniqueYears = [
    ...new Set(
      transactions
        .map((t) => {
          const d = parseDate(t.transaction_date);
          return d ? d.getFullYear() : null;
        })
        .filter(Boolean),
    ),
  ].sort((a, b) => b - a);

  const filteredTxs = transactions.filter((tx) => {
    if (filterStatus !== "ALL" && tx.status !== filterStatus) return false;

    if (filterMonth || filterYear) {
      const d = parseDate(tx.transaction_date);
      if (d) {
        if (filterMonth && months[d.getMonth()] !== filterMonth) return false;
        if (filterYear && d.getFullYear().toString() !== filterYear.toString())
          return false;
      } else {
        return false;
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (tx.narration || "").toLowerCase().includes(q) ||
        (tx.matched_unit || "").toLowerCase().includes(q) ||
        String(tx.amount || "").includes(q)
      );
    }
    return true;
  });

  const TABS = [
    {
      key: "transactions",
      label: "All Transactions",
      icon: <FileSpreadsheet size={15} />,
    },
    {
      key: "review",
      label: "Needs Review",
      icon: <AlertCircle size={15} />,
      badge: stats.review,
    },
    { key: "training", label: "AI Training", icon: <Brain size={15} /> },
    { key: "vouchers", label: "Expense Vouchers", icon: <Receipt size={15} /> },
  ];

  return (
    <div className="ai-page">
      {/* ===== HEADER ===== */}
      <div className="ai-header-card">
        <div className="ai-header-left">
          <div className="ai-brain-icon">
            <Brain size={26} />
          </div>
          <div>
            <h2 className="ai-title">AI Bank Reconciler</h2>
            <p className="ai-subtitle">
              Automated statement import, classification & expense voucher
              generation
            </p>
          </div>
        </div>
        <div className="ai-header-actions">
          <button
            className="ai-btn outline"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? "spin" : ""} /> Refresh
          </button>
          <button
            className="ai-btn outline"
            onClick={handleExportExcel}
            disabled={isLoading || transactions.length === 0}
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            className="ai-btn outline"
            onClick={handleClearAll}
            disabled={isLoading}
            style={{ color: "#fb7185", borderColor: "rgba(244,63,94,0.3)" }}
          >
            <Trash2 size={15} /> Clear All
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: "none" }}
            accept=".xls,.xlsx,.csv"
          />
          <button
            className="ai-btn outline"
            onClick={() => fileInputRef.current.click()}
            disabled={isLoading}
          >
            <UploadCloud size={15} /> Upload Statement
          </button>
          <button
            className="ai-btn glow"
            onClick={handleProcessAI}
            disabled={isProcessing || isLoading}
          >
            {isProcessing ? (
              <RefreshCw size={15} className="spin" />
            ) : (
              <Zap size={15} />
            )}
            Run AI Processor
          </button>
          <button
            className={`ai-btn ${stats.review === 0 && stats.matched > 0 ? "glow" : "outline"}`}
            onClick={handleSubmitToAccounting}
            disabled={
              stats.review > 0 ||
              isProcessing ||
              isLoading ||
              stats.matched === 0
            }
            style={
              stats.review > 0
                ? { opacity: 0.5, cursor: "not-allowed" }
                : {
                  background: "linear-gradient(135deg, #10b981, #34d399)",
                  color: "white",
                }
            }
          >
            <CheckCircle size={15} /> Submit To Accounting
          </button>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="ai-kpi-grid">
        {[
          {
            label: "Total Imported",
            value: stats.total,
            icon: <Database size={18} />,
            cls: "primary",
          },
          {
            label: "Total Credit",
            value: formatAmount(stats.creditAmount),
            icon: <TrendingUp size={18} />,
            cls: "success",
          },
          {
            label: "Total Debit",
            value: formatAmount(stats.debitAmount),
            icon: <TrendingDown size={18} />,
            cls: "warning",
          },
          {
            label: "Auto-Matched",
            value: stats.matched,
            icon: <CheckCircle size={18} />,
            cls: "success",
          },
          {
            label: "Needs Review",
            value: stats.review,
            icon: <AlertCircle size={18} />,
            cls: "warning",
          },
          {
            label: "Pending AI",
            value: stats.pending,
            icon: <Clock size={18} />,
            cls: "pending",
          },
        ].map((k) => (
          <div key={k.label} className={`ai-kpi-card ${k.cls}`}>
            <div className={`kpi-icon-wrap ${k.cls}`}>{k.icon}</div>
            <div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== TABS ===== */}
      <div className="ai-tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`ai-tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon} {t.label}
            {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
        <div className="ai-tab-actions">
          {activeTab === "training" && (
            <button
              className="ai-btn glow sm"
              onClick={() => {
                setEditingTrainingId(null);
                setIsTrainModalOpen(true);
              }}
            >
              <PlusCircle size={14} /> Add Training
            </button>
          )}
        </div>
      </div>

      {/* ===== TRANSACTIONS TAB ===== */}
      {activeTab === "transactions" && (
        <div className="ai-panel">
          <div className="ai-toolbar" style={{ alignItems: "center" }}>
            <div className="ai-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search narrations, amounts, units..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Filter size={15} color="var(--text-dim)" />
              <select
                className="ai-select-inline"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="">All Months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="ai-select-inline"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">All Years</option>
                {uniqueYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="ai-filter-pills" style={{ marginLeft: "auto" }}>
              {[
                "ALL",
                "PENDING",
                "MAINTENANCE",
                "EXPENSE",
                "SINKING_FUND",
                "REVIEW",
              ].map((f) => (
                <button
                  key={f}
                  className={`ai-pill ${filterStatus === f ? "active" : ""}`}
                  onClick={() => setFilterStatus(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="ai-table-wrap">
            {isLoading ? (
              <div className="ai-empty">Loading...</div>
            ) : filteredTxs.length === 0 ? (
              <div className="ai-empty">No transactions found.</div>
            ) : (
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Narration</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Matched Unit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxs.map((tx) => {
                    let ownerName = tx.matched_owner || "";
                    if (!tx.matched_owner && tx.matched_unit) {
                      const unitMatch = members.find(m => String(m.unit_no) === String(tx.matched_unit));
                      if (unitMatch) ownerName = unitMatch.new_owner;
                    }
                    return (
                      <tr
                        key={tx.id}
                        className={tx.status === "REVIEW" ? "row-warn" : ""}
                      >
                        <td className="td-dim">
                          {formatDate(tx.transaction_date)}
                        </td>
                        <td className="td-narration" title={tx.narration}>
                          {tx.narration}
                        </td>
                        <td>
                          <span
                            className={`tx-pill ${(tx.transaction_type || "").toLowerCase()}`}
                          >
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="td-bold" style={{ whiteSpace: "nowrap" }}>
                          {formatAmount(tx.amount)}
                        </td>
                        <td className="td-unit">
                          {tx.matched_unit ? (
                            <>
                              <span style={{ fontWeight: 500 }}>{tx.matched_unit}</span>
                              {ownerName && (
                                <div style={{ fontSize: "11px", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px", marginTop: "2px" }}>
                                  {ownerName}
                                </div>
                              )}
                            </>
                          ) : ownerName ? (
                            <div style={{ fontSize: "12px", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }} title={ownerName}>
                              {ownerName}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{getStatusBadge(tx.status)}</td>
                        <td>
                          <div className="td-actions">
                            <button
                              className="icon-action"
                              title="Edit & Train"
                              onClick={() => openEditTx(tx)}
                            >
                              <Edit3 size={14} />
                            </button>
                            {tx.accounting_posted && (
                              <span
                                className="tx-pill credit"
                                style={{ fontSize: "9px" }}
                              >
                                ✓ POSTED
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== REVIEW TAB ===== */}
      {activeTab === "review" && (
        <div className="ai-panel">
          <div className="ai-panel-heading">
            <AlertCircle size={18} color="var(--warning)" />
            <span>
              {reviewTxs.length} transactions need manual classification
            </span>
          </div>
          <div className="ai-table-wrap">
            {isLoading ? (
              <div className="ai-empty">Loading...</div>
            ) : reviewTxs.length === 0 ? (
              <div className="ai-empty ai-success-state">
                <CheckCircle size={40} />
                <p>All transactions classified!</p>
              </div>
            ) : (
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Narration</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewTxs.map((tx) => (
                    <tr key={tx.id} className="row-warn">
                      <td className="td-dim">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="td-narration" title={tx.narration}>
                        {tx.narration}
                      </td>
                      <td>
                        <span
                          className={`tx-pill ${(tx.transaction_type || "").toLowerCase()}`}
                        >
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="td-bold">{formatAmount(tx.amount)}</td>
                      <td>
                        <div className="td-actions">
                          <button
                            className="ai-btn sm outline"
                            onClick={() => openEditTx(tx)}
                          >
                            <Edit3 size={13} /> Classify
                          </button>
                          <button
                            className="ai-btn sm teal"
                            onClick={() => openTrainFromTx(tx)}
                          >
                            <Brain size={13} /> Train AI
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== TRAINING TAB ===== */}
      {activeTab === "training" && (
        <div className="ai-panel">
          <div className="ai-panel-heading">
            <Brain size={18} color="var(--primary)" />
            <span>{trainings.length} AI keyword rules trained</span>
          </div>
          <div className="ai-table-wrap">
            {isLoading ? (
              <div className="ai-empty">Loading...</div>
            ) : trainings.length === 0 ? (
              <div className="ai-empty">
                <Brain size={40} opacity={0.3} />
                <p>No training data yet. Add keywords to teach the AI!</p>
                <button
                  className="ai-btn glow"
                  onClick={() => setIsTrainModalOpen(true)}
                >
                  <PlusCircle size={14} /> Add First Rule
                </button>
              </div>
            ) : (
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Keyword</th>
                    <th>Unit No</th>
                    <th>Category</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map((t, i) => (
                    <tr key={t.id}>
                      <td className="td-dim">{i + 1}</td>
                      <td>
                        <code className="keyword-pill">{t.keyword}</code>
                      </td>
                      <td className="td-unit">{t.unit_no || "—"}</td>
                      <td>{getStatusBadge(t.category)}</td>
                      <td>
                        <div className="td-actions">
                          <button
                            className="icon-action"
                            title="Edit Rule"
                            onClick={() => openEditTraining(t)}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="icon-action"
                            style={{ color: "var(--accent)" }}
                            title="Delete Rule"
                            onClick={() => handleDeleteTraining(t.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== VOUCHERS TAB ===== */}
      {activeTab === "vouchers" && (
        <div className="ai-panel">
          <div className="ai-panel-heading">
            <Receipt size={18} color="var(--secondary)" />
            <span>{vouchers.length} expense vouchers generated</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <button
                className="ai-btn sm"
                style={{ background: "var(--secondary)", color: "#fff" }}
                onClick={handleGenerateExpenses}
                title="Generate / Sync vouchers for all Expense transactions"
              >
                <Receipt size={13} /> Generate Vouchers
              </button>
              <button
                className="ai-btn sm outline"
                onClick={fetchVouchers}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
          <div className="ai-table-wrap">
            {isLoading ? (
              <div className="ai-empty">Loading...</div>
            ) : vouchers.length === 0 ? (
              <div className="ai-empty">
                <Receipt size={40} opacity={0.3} />
                <p>
                  No vouchers generated yet. Click "Generate Vouchers" to generate expense vouchers.
                </p>
                <button
                  className="ai-btn glow sm"
                  style={{ marginTop: "12px" }}
                  onClick={handleGenerateExpenses}
                >
                  <Receipt size={14} /> Generate Expense Vouchers Now
                </button>
              </div>
            ) : (
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Voc #</th>
                    <th>Date</th>
                    <th>Drawn on</th>
                    <th>Particulars</th>
                    <th>Ref No</th>
                    <th>Amount</th>
                    <th>Narration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => {
                    const drawnOn = v.drawn_on || extractDrawnOn(v.narration);
                    const particulars = v.particulars || extractParticulars(v.narration);
                    return (
                      <tr key={v.id}>
                        <td className="td-bold">#{v.voucher_no}</td>
                        <td className="td-dim">{formatDate(v.expense_date)}</td>
                        <td style={{ fontWeight: 600, color: "var(--accent-glow, #38bdf8)", whiteSpace: "nowrap" }}>
                          {drawnOn || "—"}
                        </td>
                        <td style={{ color: "var(--text-main, #e2e8f0)", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {particulars || "—"}
                        </td>
                        <td className="td-dim" style={{ fontFamily: "monospace", fontSize: "12px" }}>
                          {v.reference_no || "—"}
                        </td>
                        <td
                          className="td-bold"
                          style={{ color: "var(--accent, #f87171)", whiteSpace: "nowrap" }}
                        >
                          {formatAmount(v.amount)}
                        </td>
                        <td className="td-narration" title={v.narration}>
                          {v.narration}
                        </td>
                        <td>{getStatusBadge(v.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {editingTx && (
        <div className="ai-overlay">
          <div className="ai-modal">
            <div className="modal-head">
              <h3>
                <Edit3 size={16} /> Classify Transaction
              </h3>
              <button onClick={() => setEditingTx(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="tx-preview">
                <div className="tx-preview-label">Narration</div>
                <div className="tx-preview-val">{editingTx.narration}</div>
                <div className="tx-preview-meta">
                  <span>{formatAmount(editingTx.amount)}</span>
                  <span
                    className={`tx-pill ${(editingTx.transaction_type || "").toLowerCase()}`}
                  >
                    {editingTx.transaction_type}
                  </span>
                </div>
              </div>
              <div className="form-row">
                <label>Status</label>
                <select
                  className="ai-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {[
                    "PENDING",
                    "MAINTENANCE",
                    "SINKING_FUND",
                    "EXPENSE",
                    "REVIEW",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {["MAINTENANCE", "SINKING_FUND"].includes(editStatus) && (
                <div className="form-row">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label style={{ margin: 0 }}>Matched Unit No (Select multiple or type)</label>
                    {editUnits.length > 0 && (
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--accent, #f87171)",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: 0
                        }}
                        onClick={() => {
                          setEditUnits([]);
                          setEditUnitInput("");
                          setEditOwner("");
                        }}
                      >
                        Clear All ({editUnits.length})
                      </button>
                    )}
                  </div>

                  {/* Multi-Select Trigger & Chips */}
                  <div className="unit-multi-select" ref={editUnitDropdownRef}>
                    <div
                      className="unit-select-trigger"
                      onClick={() => setEditUnitDropdownOpen(!editUnitDropdownOpen)}
                      style={{ cursor: "pointer", minHeight: "42px" }}
                    >
                      {editUnits.length > 0 ? (
                        <div className="unit-chips" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {editUnits.map((u) => (
                            <span key={u} className="unit-chip" style={{ background: "rgba(124, 58, 237, 0.2)", border: "1px solid rgba(124, 58, 237, 0.4)", borderRadius: "6px", padding: "3px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              Unit {u}
                              <X
                                size={12}
                                style={{ cursor: "pointer" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEditUnitSelection(u);
                                }}
                              />
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="unit-placeholder" style={{ color: "var(--text-dim)" }}>
                          Click to select units ({members.length} members loaded)...
                        </span>
                      )}
                      <ChevronRight
                        size={14}
                        className={`unit-chevron ${editUnitDropdownOpen ? "open" : ""}`}
                        style={{ marginLeft: "auto", transform: editUnitDropdownOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "0.2s" }}
                      />
                    </div>

                    {editUnitDropdownOpen && (
                      <div className="unit-dropdown" style={{ maxHeight: "220px", overflowY: "auto" }}>
                        <input
                          className="unit-dropdown-search"
                          type="text"
                          placeholder="Search unit or owner name..."
                          value={editUnitSearch}
                          onChange={(e) => setEditUnitSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        <div className="unit-dropdown-list">
                          {[...members]
                            .sort((a, b) => {
                              const numA = parseInt(a.unit_no) || 0;
                              const numB = parseInt(b.unit_no) || 0;
                              return numA - numB;
                            })
                            .filter((m) => {
                              const q = editUnitSearch.toLowerCase();
                              return (
                                !q ||
                                String(m.unit_no).toLowerCase().includes(q) ||
                                (m.new_owner || "").toLowerCase().includes(q)
                              );
                            })
                            .map((m) => {
                              const unitStr = String(m.unit_no).trim();
                              const selected = editUnits.includes(unitStr);
                              return (
                                <div
                                  key={m.id || unitStr}
                                  className={`unit-option ${selected ? "selected" : ""}`}
                                  onClick={() => toggleEditUnitSelection(unitStr)}
                                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", cursor: "pointer" }}
                                >
                                  <div className={`unit-checkbox ${selected ? "checked" : ""}`}>
                                    {selected ? <CheckCircle size={14} color="var(--primary, #7c3aed)" /> : <div style={{ width: 14, height: 14, border: "1px solid var(--border)", borderRadius: "3px" }} />}
                                  </div>
                                  <span className="unit-option-label" style={{ fontWeight: 500 }}>
                                    Unit {m.unit_no} {m.new_owner ? `— ${m.new_owner}` : ""}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Direct Comma-Separated Input */}
                  <div style={{ marginTop: "8px" }}>
                    <input
                      type="text"
                      className="ai-input"
                      placeholder="Or type comma-separated units (e.g. 201, 202, 209, 210, 211)"
                      value={editUnitInput}
                      onChange={(e) => handleEditUnitRawInputChange(e.target.value)}
                    />
                  </div>

                  {editUnits.length > 0 && (
                    <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
                      Selected ({editUnits.length} units): <strong style={{ color: "var(--accent-glow, #38bdf8)" }}>{editUnits.join(", ")}</strong>
                      {editOwner && (
                        <div style={{ marginTop: "2px" }}>
                          Owner: <strong style={{ color: "var(--text-main, #fff)" }}>{editOwner}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editStatus === "EXPENSE" && (
                <div className="form-row">
                  <label>Vendor / Payee Name</label>
                  <input
                    type="text"
                    className="ai-input"
                    placeholder="Enter vendor / payee name (e.g. BP Petrol Pump)"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                  />
                </div>
              )}

              {editingTx && (editUnits.length > 0 || (editStatus === "EXPENSE" && editOwner)) && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Brain size={14} />
                  AI will auto-learn: <strong>"{extractKeyword(editingTx.narration)}"</strong> → {editStatus === "EXPENSE" ? editOwner : `Unit ${editUnits.join(", ")}`}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button
                className="ai-btn outline"
                onClick={() => setEditingTx(null)}
              >
                Cancel
              </button>
              <button className="ai-btn glow" onClick={handleSaveEdit}>
                <Brain size={14} /> Save & Train
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TRAIN AI MODAL ===== */}
      {isTrainModalOpen && (
        <div className="ai-overlay">
          <div className="ai-modal">
            <div className="modal-head">
              <h3>
                <Brain size={16} />{" "}
                {editingTrainingId ? "Edit AI Rule" : "Train AI Rule"}
              </h3>
              <button onClick={closeTrainModal}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {trainFromTx && (
                <div className="tx-preview">
                  <div className="tx-preview-label">
                    Training from transaction
                  </div>
                  <div className="tx-preview-val">{trainFromTx.narration}</div>
                </div>
              )}
              <div className="form-row">
                <label>Keyword (from narration)</label>
                <input
                  className="ai-input"
                  type="text"
                  value={trainKeyword}
                  onChange={(e) => setTrainKeyword(e.target.value)}
                  placeholder="e.g. SHARMA, UPI-101"
                />
              </div>
              <div className="form-row">
                <label>Unit No (optional — select one or more)</label>
                <div className="unit-multi-select" ref={unitDropdownRef}>
                  <div
                    className="unit-select-trigger"
                    onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                  >
                    {Array.isArray(trainUnit) && trainUnit.length > 0 ? (
                      <div className="unit-chips">
                        {trainUnit.map((u) => (
                          <span key={u} className="unit-chip">
                            {u}
                            <X
                              size={12}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUnitSelection(u);
                              }}
                            />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="unit-placeholder">
                        Click to select units...
                      </span>
                    )}
                    <ChevronRight
                      size={14}
                      className={`unit-chevron ${unitDropdownOpen ? "open" : ""}`}
                    />
                  </div>
                  {unitDropdownOpen && (
                    <div className="unit-dropdown">
                      <input
                        className="unit-dropdown-search"
                        type="text"
                        placeholder="Search units..."
                        value={unitSearchQuery}
                        onChange={(e) => setUnitSearchQuery(e.target.value)}
                        autoFocus
                      />
                      <div className="unit-dropdown-list">
                        {[...members]
                          .sort((a, b) => {
                            const numA = parseInt(a.unit_no) || 0;
                            const numB = parseInt(b.unit_no) || 0;
                            const typeA = (a.unit_type || "").toLowerCase();
                            const typeB = (b.unit_type || "").toLowerCase();
                            if (typeA !== typeB)
                              return typeA.localeCompare(typeB);
                            return numA - numB;
                          })
                          .filter((m) => {
                            const q = unitSearchQuery.toLowerCase();
                            const combined1 =
                              `${m.unit_type} - ${m.unit_no}`.toLowerCase();
                            const combined2 =
                              `${m.unit_type} ${m.unit_no}`.toLowerCase();
                            return (
                              !q ||
                              String(m.unit_no).toLowerCase().includes(q) ||
                              (m.new_owner || "").toLowerCase().includes(q) ||
                              (m.unit_type || "").toLowerCase().includes(q) ||
                              combined1.includes(q) ||
                              combined2.includes(q)
                            );
                          })
                          .map((m) => {
                            const unitStr = String(m.unit_no);
                            const selected =
                              Array.isArray(trainUnit) &&
                              trainUnit.includes(unitStr);
                            return (
                              <div
                                key={m.id}
                                className={`unit-option ${selected ? "selected" : ""}`}
                                onClick={() => toggleUnitSelection(unitStr)}
                              >
                                <div
                                  className={`unit-checkbox ${selected ? "checked" : ""}`}
                                >
                                  {selected && <CheckCircle size={12} />}
                                </div>
                                <span className="unit-option-label">
                                  {m.unit_type} - {m.unit_no}
                                </span>
                                <span className="unit-option-owner">
                                  {m.new_owner || m.old_owner || ""}
                                </span>
                              </div>
                            );
                          })}
                        {members.length === 0 && (
                          <div className="unit-empty">No members found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <label>Category</label>
                <select
                  className="ai-select"
                  value={trainCategory}
                  onChange={(e) => setTrainCategory(e.target.value)}
                >
                  {["MAINTENANCE", "SINKING_FUND", "EXPENSE"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="ai-btn outline" onClick={closeTrainModal}>
                Cancel
              </button>
              <button className="ai-btn glow" onClick={handleTrainAI}>
                <Brain size={14} />{" "}
                {editingTrainingId ? "Update AI" : "Train AI"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
