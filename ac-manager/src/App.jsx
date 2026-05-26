import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGES = [
  { id: "survey",   label: "場勘確認" },
  { id: "schedule", label: "排程確認" },
  { id: "delivery", label: "設備到貨" },
  { id: "install",  label: "安裝施工" },
  { id: "test",     label: "測試運行" },
  { id: "complete", label: "完工驗收" },
];

const STATUS_META = {
  pending:   { label: "待處理", bg: "#f1f5f9", color: "#475569" },
  sent:      { label: "已發送", bg: "#fef3c7", color: "#d97706" },
  accepted:  { label: "已接受", bg: "#dcfce7", color: "#15803d" },
  active:    { label: "進行中", bg: "#dbeafe", color: "#1d4ed8" },
  completed: { label: "已完成", bg: "#dcfce7", color: "#15803d" },
  cancelled: { label: "已取消", bg: "#fee2e2", color: "#dc2626" },
};

const PRESETS = [
  { name: "分離式冷暖氣 1.5噸", price: 28000 },
  { name: "分離式冷暖氣 2噸",   price: 35000 },
  { name: "分離式冷暖氣 3噸",   price: 45000 },
  { name: "窗型冷氣 1噸",       price: 12000 },
  { name: "吊隱式冷氣 2噸",     price: 55000 },
  { name: "標準安裝費",          price: 3500  },
  { name: "進階安裝費",          price: 6000  },
  { name: "冷媒配管（每米）",    price: 350   },
  { name: "排水配管（每米）",    price: 200   },
  { name: "舊機拆除費",          price: 1500  },
  { name: "電源配線費",          price: 2500  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const genId    = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmtMoney = (n) => `NT$ ${Number(n || 0).toLocaleString()}`;
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("zh-TW") : "";

// Use localStorage (works in browser + Capacitor Android/iOS)
const ls = {
  get:    (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:    (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  remove: (k) => localStorage.removeItem(k),
};

const resizeToBlob = (file) =>
  new Promise((res) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const r = Math.min(900 / img.width, 900 / img.height, 1);
        canvas.width  = Math.round(img.width  * r);
        canvas.height = Math.round(img.height * r);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => res(blob), "image/jpeg", 0.80);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  card:  { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem" },
  row:   { display: "flex", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 },
};

const btnStyle = (bg = "transparent", color = "var(--color-text-primary)", border = "var(--color-border-secondary)") => ({
  padding: "7px 13px", borderRadius: 6, border: `0.5px solid ${border}`,
  background: bg, color, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
});

// ─── Shared Components ────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.pending;
  return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: m.bg, color: m.color }}>{m.label}</span>;
};

const BackBtn = ({ onClick, label }) => (
  <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#f59e0b", marginBottom: 14, padding: 0 }}>
    ← {label}
  </button>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={S.label}>{label}</label>
    {children}
  </div>
);

const Empty = ({ text, sub }) => (
  <div style={{ ...S.card, textAlign: "center", padding: "48px 20px", color: "var(--color-text-secondary)" }}>
    <div style={{ fontSize: 16, marginBottom: 6 }}>{text}</div>
    <div style={{ fontSize: 13 }}>{sub}</div>
  </div>
);

const ProgressStrip = ({ stagesData }) => (
  <div>
    <div style={{ display: "flex", alignItems: "center" }}>
      {STAGES.map((s, idx) => {
        const done = stagesData?.[s.id]?.completed;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: done ? "#f59e0b" : "var(--color-background-secondary)", border: `2px solid ${done ? "#f59e0b" : "var(--color-border-tertiary)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: done ? "#0f1f3d" : "var(--color-text-secondary)", fontWeight: done ? 500 : 400 }}>
              {done ? "✓" : idx + 1}
            </div>
            {idx < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: done ? "#f59e0b" : "var(--color-border-tertiary)", margin: "0 2px" }} />}
          </div>
        );
      })}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{STAGES[0].label}</span>
      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{STAGES[STAGES.length - 1].label}</span>
    </div>
  </div>
);

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: "var(--color-text-secondary)", background: "var(--color-background-tertiary)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: 36, height: 36, border: "3px solid var(--color-border-tertiary)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 14 }}>連接 Supabase 中...</span>
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onConnect }) {
  const [url,     setUrl]     = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error,   setError]   = useState("");

  const handleConnect = async () => {
    if (!url.trim() || !anonKey.trim()) return setError("請填寫所有欄位");
    setTesting(true); setError("");
    try {
      await onConnect(url.trim(), anonKey.trim(), true);
    } catch (err) {
      setError("連接失敗：" + (err.message || "請確認 URL / Key 正確，且資料表已建立"));
    }
    setTesting(false);
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background-tertiary)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, background: "#0f1f3d", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 14px" }}>❄</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)" }}>冷氣安裝管理系統</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)" }}>填入 Supabase 連線資訊以開始使用</p>
        </div>
        <div style={S.card}>
          <Field label="Supabase Project URL">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxxxxxxxxxx.supabase.co" />
          </Field>
          <Field label="Supabase Anon Key (public)">
            <input value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..." type="password" />
          </Field>
          {error && (
            <div style={{ padding: "10px 12px", background: "#fee2e2", borderRadius: 6, fontSize: 13, color: "#dc2626", marginBottom: 14, lineHeight: 1.5 }}>{error}</div>
          )}
          <button onClick={handleConnect} disabled={testing} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: testing ? "#d1d5db" : "#f59e0b", color: "#0f1f3d", fontWeight: 600, cursor: testing ? "default" : "pointer", fontSize: 15, marginBottom: 16 }}>
            {testing ? "連接中..." : "連接 Supabase ↗"}
          </button>
          <div style={{ padding: "12px 14px", background: "var(--color-background-secondary)", borderRadius: 8, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
            <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>首次使用前置作業</div>
            1. Supabase → SQL Editor → 執行建表語法<br />
            2. Storage → New Bucket → 名稱：<code style={{ background: "#e2e8f0", padding: "1px 4px", borderRadius: 3 }}>ac-photos</code>，設為 Public<br />
            3. Project Settings → API → 複製 URL 和 anon key
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [supabase,   setSupabase]   = useState(null);
  const [configured, setConfigured] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("dashboard");
  const [view,       setView]       = useState({ type: null, data: null });
  const [customers,  setCustomers]  = useState([]);
  const [quotes,     setQuotes]     = useState([]);
  const [installs,   setInstalls]   = useState([]);
  const [toast,      setToast]      = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const cfg = ls.get("ac:sb-config");
    if (cfg?.url && cfg?.anonKey) {
      handleConnect(cfg.url, cfg.anonKey, false).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAll = async (sb) => {
    const [c, q, i] = await Promise.all([
      sb.from("customers").select("*").order("created_at", { ascending: true }),
      sb.from("quotes").select("*").order("created_at", { ascending: false }),
      sb.from("installations").select("*").order("created_at", { ascending: false }),
    ]);
    setCustomers(c.data || []);
    setQuotes(q.data || []);
    setInstalls(i.data || []);
  };

  const handleConnect = async (url, anonKey, save = true) => {
    const sb = createClient(url, anonKey);
    const { error } = await sb.from("customers").select("id").limit(1);
    if (error && error.code !== "PGRST116") throw error;
    if (save) ls.set("ac:sb-config", { url, anonKey });
    setSupabase(sb);
    setConfigured(true);
    await fetchAll(sb);
    setLoading(false);
  };

  const go   = (type, data = null) => setView({ type, data });
  const back = () => setView({ type: null, data: null });

  // CRUD
  const saveCustomer = async (c) => {
    const { error } = await supabase.from("customers").upsert(c);
    if (error) return showToast("儲存失敗：" + error.message, "error");
    setCustomers((p) => p.some((x) => x.id === c.id) ? p.map((x) => x.id === c.id ? c : x) : [...p, c]);
    showToast("客戶已儲存"); back();
  };

  const deleteCustomer = async (id) => {
    await supabase.from("customers").delete().eq("id", id);
    setCustomers((p) => p.filter((c) => c.id !== id));
    showToast("已刪除");
  };

  const saveQuote = async (q) => {
    const { error } = await supabase.from("quotes").upsert(q);
    if (error) return showToast("儲存失敗：" + error.message, "error");
    setQuotes((p) => p.some((x) => x.id === q.id) ? p.map((x) => x.id === q.id ? q : x) : [...p, q]);
    showToast("報價單已儲存"); back();
  };

  const deleteQuote = async (id) => {
    await supabase.from("quotes").delete().eq("id", id);
    setQuotes((p) => p.filter((q) => q.id !== id));
    showToast("已刪除");
  };

  const saveInstall = async (inst) => {
    const { error } = await supabase.from("installations").upsert(inst);
    if (error) return showToast("更新失敗", "error");
    setInstalls((p) => p.some((i) => i.id === inst.id) ? p.map((i) => i.id === inst.id ? inst : i) : [...p, inst]);
  };

  const createInstall = async (quote) => {
    const inst = { id: genId(), quote_id: quote.id, customer_id: quote.customer_id, status: "active", stages: {}, photos: {}, created_at: Date.now() };
    const { error } = await supabase.from("installations").insert(inst);
    if (error) return showToast("建立工單失敗", "error");
    const updQuote = { ...quote, status: "accepted" };
    await supabase.from("quotes").upsert(updQuote);
    setInstalls((p) => [...p, inst]);
    setQuotes((p) => p.map((q) => q.id === quote.id ? updQuote : q));
    showToast("工單已建立"); setTab("installations"); back();
  };

  const uploadPhoto = async (file, installId, stageId) => {
    const path = `${installId}/${stageId}/${genId()}.jpg`;
    const blob = await resizeToBlob(file);
    const { error } = await supabase.storage.from("ac-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("ac-photos").getPublicUrl(path);
    return { url: publicUrl, path, name: file.name, uploadedAt: Date.now() };
  };

  const deletePhoto = async (path) => {
    if (path) await supabase.storage.from("ac-photos").remove([path]);
  };

  const disconnect = () => {
    ls.remove("ac:sb-config");
    setConfigured(false); setSupabase(null);
    setCustomers([]); setQuotes([]); setInstalls([]);
    setLoading(false);
  };

  if (loading)     return <LoadingScreen />;
  if (!configured) return <SetupScreen onConnect={handleConnect} />;

  const TABS = [
    { id: "dashboard",     label: "儀表板" },
    { id: "quotes",        label: "報價單" },
    { id: "installations", label: "安裝進度" },
    { id: "customers",     label: "客戶" },
  ];

  const changeTab = (t) => { back(); setTab(t); };

  const renderContent = () => {
    if (view.type === "newCustomer" || view.type === "editCustomer")
      return <CustomerForm customer={view.type === "editCustomer" ? view.data : null} onSave={saveCustomer} onBack={back} />;
    if (view.type === "newQuote" || view.type === "editQuote")
      return <QuoteForm quote={view.type === "editQuote" ? view.data : null} customers={customers} onSave={saveQuote} onBack={back} />;
    if (view.type === "viewQuote")
      return <QuoteDetail quote={view.data} customers={customers} installs={installs} onBack={back} onEdit={(q) => go("editQuote", q)} onCreateInstall={createInstall} />;
    if (view.type === "installDetail")
      return <InstallDetail install={view.data} quote={quotes.find((q) => q.id === view.data.quote_id)} customer={customers.find((c) => c.id === view.data.customer_id)} onSave={saveInstall} onUploadPhoto={uploadPhoto} onDeletePhoto={deletePhoto} onBack={back} showToast={showToast} />;
    if (tab === "dashboard")     return <Dashboard quotes={quotes} installs={installs} customers={customers} onTabChange={changeTab} />;
    if (tab === "quotes")        return <QuoteList quotes={quotes} customers={customers} installs={installs} onNew={() => go("newQuote")} onView={(q) => go("viewQuote", q)} onEdit={(q) => go("editQuote", q)} onDelete={deleteQuote} onCreateInstall={createInstall} />;
    if (tab === "installations") return <InstallList installs={installs} customers={customers} onView={(i) => go("installDetail", i)} />;
    if (tab === "customers")     return <CustomerList customers={customers} onNew={() => go("newCustomer")} onEdit={(c) => go("editCustomer", c)} onDelete={deleteCustomer} />;
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", background: "var(--color-background-tertiary)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ background: "#0f1f3d", padding: "0 16px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "#f59e0b", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>❄</div>
            <div>
              <div style={{ color: "white", fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>冷氣安裝管理</div>
              <div style={{ color: "#64748b", fontSize: 10 }}>Supabase ☁</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => changeTab(t.id)} style={{ padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, background: tab === t.id && !view.type ? "#f59e0b" : "transparent", color: tab === t.id && !view.type ? "#0f1f3d" : "#94a3b8", fontWeight: tab === t.id && !view.type ? 600 : 400 }}>
                {t.label}
              </button>
            ))}
            <button onClick={disconnect} title="斷開連線" style={{ marginLeft: 6, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #334155", background: "none", color: "#64748b", cursor: "pointer", fontSize: 11 }}>⏏</button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ padding: "10px 20px", background: toast.type === "error" ? "#fee2e2" : "#dcfce7", color: toast.type === "error" ? "#dc2626" : "#15803d", fontSize: 13, fontWeight: 500, textAlign: "center" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: "16px", maxWidth: 900, margin: "0 auto" }}>{renderContent()}</div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ quotes, installs, customers, onTabChange }) {
  const revenue = quotes.filter((q) => ["accepted","active"].includes(q.status)).reduce((s, q) => s + (q.total || 0), 0);
  const stats = [
    { label: "客戶數", value: customers.length, accent: false },
    { label: "報價單", value: quotes.length, accent: false },
    { label: "進行中", value: installs.filter((i) => i.status === "active").length, accent: true },
    { label: "完工",   value: installs.filter((i) => i.status === "completed").length, accent: false },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ ...S.card, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: s.accent ? "#f59e0b" : "var(--color-text-primary)" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.card, marginBottom: 12, padding: "14px 18px", background: "#0f1f3d", border: "none" }}>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>成交總金額</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: "#f59e0b" }}>{fmtMoney(revenue)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <RecentPanel title="最近安裝工單" items={[...installs].sort((a, b) => b.created_at - a.created_at).slice(0, 4)} customers={customers} type="install" onMore={() => onTabChange("installations")} />
        <RecentPanel title="最近報價單"   items={[...quotes].sort((a, b) => b.created_at - a.created_at).slice(0, 4)}   customers={customers} type="quote"   onMore={() => onTabChange("quotes")} />
      </div>
    </div>
  );
}

function RecentPanel({ title, items, customers, type, onMore }) {
  return (
    <div style={S.card}>
      <div style={{ ...S.row, marginBottom: 10 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>{title}</span>
        <button onClick={onMore} style={{ fontSize: 11, color: "#f59e0b", background: "none", border: "none", cursor: "pointer" }}>全部</button>
      </div>
      {items.length === 0 && <div style={{ color: "var(--color-text-secondary)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>暫無資料</div>}
      {items.map((item, idx) => {
        const cust = customers.find((c) => c.id === item.customer_id);
        return (
          <div key={item.id} style={{ padding: "8px 0", borderBottom: idx < items.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", ...S.row }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{cust?.name || "未知"}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{fmtDate(item.created_at)}</div>
            </div>
            {type === "quote" ? (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{fmtMoney(item.total)}</div>
                <StatusBadge status={item.status} />
              </div>
            ) : (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>
                  {STAGES.filter((s) => item.stages?.[s.id]?.completed).length}/{STAGES.length}
                </div>
                <StatusBadge status={item.status} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

function QuoteList({ quotes, customers, installs, onNew, onView, onEdit, onDelete, onCreateInstall }) {
  return (
    <div>
      <div style={{ ...S.row, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>報價單管理</h2>
        <button onClick={onNew} style={{ background: "#f59e0b", color: "#0f1f3d", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>+ 新增</button>
      </div>
      {quotes.length === 0 && <Empty text="尚無報價單" sub="點擊右上角建立" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {quotes.map((q) => {
          const cust    = customers.find((c) => c.id === q.customer_id);
          const hasInst = installs.some((i) => i.quote_id === q.id);
          return (
            <div key={q.id} style={{ ...S.card, padding: "12px 14px" }}>
              <div style={{ ...S.row, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{cust?.name || "未知客戶"}</span>
                  <StatusBadge status={q.status} />
                  {hasInst && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "#dbeafe", color: "#1d4ed8" }}>工單已建立</span>}
                </div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{fmtMoney(q.total)}</span>
              </div>
              <div style={{ ...S.row }}>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {q.items?.length || 0} 項目 • {fmtDate(q.created_at)}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={() => onView(q)} style={btnStyle()}>查看</button>
                  <button onClick={() => onEdit(q)} style={btnStyle()}>編輯</button>
                  {!hasInst && q.status !== "cancelled" && (
                    <button onClick={() => onCreateInstall(q)} style={btnStyle("#0f1f3d", "white", "#0f1f3d")}>建立工單</button>
                  )}
                  <button onClick={() => onDelete(q.id)} style={btnStyle("#fff0f0", "#dc2626", "#fecaca")}>刪除</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuoteDetail({ quote, customers, installs, onBack, onEdit, onCreateInstall }) {
  const cust    = customers.find((c) => c.id === quote.customer_id);
  const hasInst = installs.some((i) => i.quote_id === quote.id);
  return (
    <div style={{ maxWidth: 620 }}>
      <BackBtn onClick={onBack} label="返回報價單列表" />
      <div style={S.card}>
        <div style={{ ...S.row, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 600 }}>報價單詳情</h2>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{fmtDate(quote.created_at)}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <StatusBadge status={quote.status} />
            <button onClick={() => onEdit(quote)} style={btnStyle()}>編輯</button>
            {!hasInst && quote.status !== "cancelled" && (
              <button onClick={() => onCreateInstall(quote)} style={btnStyle("#0f1f3d", "white", "#0f1f3d")}>建立工單</button>
            )}
          </div>
        </div>
        <div style={{ padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontWeight: 500, marginBottom: 2 }}>{cust?.name}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {cust?.phone && `📞 ${cust.phone}  `}{cust?.address && `📍 ${cust.address}`}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 14 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              {["項目", "數量", "單價", "小計"].map((h, i) => (
                <th key={h} style={{ padding: "7px 5px", fontWeight: 500, textAlign: i === 0 ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quote.items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                <td style={{ padding: "9px 5px" }}>{item.name}</td>
                <td style={{ padding: "9px 5px", textAlign: "right" }}>{item.qty}</td>
                <td style={{ padding: "9px 5px", textAlign: "right" }}>{fmtMoney(item.price)}</td>
                <td style={{ padding: "9px 5px", textAlign: "right", fontWeight: 500 }}>{fmtMoney(item.qty * item.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 2 }}>小計：{fmtMoney(quote.subtotal)}</div>
          {quote.discount > 0 && <div style={{ fontSize: 12, color: "#10b981", marginBottom: 2 }}>折扣：-{fmtMoney(quote.discount)}</div>}
          <div style={{ fontSize: 18, fontWeight: 600 }}>總計：{fmtMoney(quote.total)}</div>
        </div>
        {quote.notes && <div style={{ marginTop: 12, padding: "9px 11px", background: "#fffbeb", border: "0.5px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e" }}>備註：{quote.notes}</div>}
      </div>
    </div>
  );
}

function QuoteForm({ quote, customers, onSave, onBack }) {
  const [customerId, setCustomerId] = useState(quote?.customer_id || "");
  const [items,      setItems]      = useState(quote?.items || [{ name: "", qty: 1, price: 0 }]);
  const [notes,      setNotes]      = useState(quote?.notes || "");
  const [discount,   setDiscount]   = useState(quote?.discount || 0);
  const [status,     setStatus]     = useState(quote?.status || "pending");

  const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
  const total    = Math.max(0, subtotal - Number(discount));
  const updItem  = (idx, k, v) => setItems((p) => p.map((x, i) => i === idx ? { ...x, [k]: v } : x));

  const handleSave = () => {
    if (!customerId) return alert("請選擇客戶");
    if (items.some((i) => !String(i.name).trim())) return alert("請填寫所有項目名稱");
    onSave({ id: quote?.id || genId(), customer_id: customerId, items: items.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price) })), notes, discount: Number(discount), subtotal, total, status, created_at: quote?.created_at || Date.now(), updated_at: Date.now() });
  };

  return (
    <div style={{ maxWidth: 660 }}>
      <BackBtn onClick={onBack} label="返回報價單列表" />
      <div style={S.card}>
        <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 600 }}>{quote ? "編輯報價單" : "新增報價單"}</h2>
        <Field label="客戶">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">選擇客戶...</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.address ? ` - ${c.address}` : ""}</option>)}
          </select>
        </Field>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>報價項目</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => setItems((prev) => [...prev, { name: p.name, qty: 1, price: p.price }])} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}>
                + {p.name}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 65px 110px 22px", gap: 7, marginBottom: 5 }}>
            {["項目名稱", "數量", "單價 NT$", ""].map((h, i) => <span key={i} style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: i > 0 ? "right" : "left" }}>{h}</span>)}
          </div>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 65px 110px 22px", gap: 7, marginBottom: 7, alignItems: "center" }}>
              <input value={item.name}  onChange={(e) => updItem(idx, "name", e.target.value)}  placeholder="項目名稱" />
              <input type="number" value={item.qty}   onChange={(e) => updItem(idx, "qty", e.target.value)}   min="1" style={{ textAlign: "center" }} />
              <input type="number" value={item.price} onChange={(e) => updItem(idx, "price", e.target.value)} min="0" style={{ textAlign: "right" }} />
              <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <button onClick={() => setItems((p) => [...p, { name: "", qty: 1, price: 0 }])} style={{ fontSize: 12, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ 新增項目</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="折扣金額"><input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" /></Field>
          <Field label="狀態">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {[["pending","待處理"],["sent","已發送"],["accepted","已接受"],["cancelled","已取消"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="備註"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ resize: "vertical" }} /></Field>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: 12, marginBottom: 18 }}>
          <div style={{ ...S.row, fontSize: 13, marginBottom: 4 }}><span>小計</span><span>{fmtMoney(subtotal)}</span></div>
          {Number(discount) > 0 && <div style={{ ...S.row, fontSize: 13, color: "#10b981", marginBottom: 4 }}><span>折扣</span><span>-{fmtMoney(discount)}</span></div>}
          <div style={{ ...S.row, fontSize: 17, fontWeight: 600, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 9 }}><span>總計</span><span>{fmtMoney(total)}</span></div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onBack} style={btnStyle()}>取消</button>
          <button onClick={handleSave} style={btnStyle("#f59e0b", "#0f1f3d", "#f59e0b")}>儲存報價單</button>
        </div>
      </div>
    </div>
  );
}

// ─── Installations ────────────────────────────────────────────────────────────

function InstallList({ installs, customers, onView }) {
  return (
    <div>
      <div style={{ ...S.row, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>安裝進度追蹤</h2>
      </div>
      {installs.length === 0 && <Empty text="尚無安裝工單" sub="請從報價單頁面建立工單" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {installs.map((inst) => {
          const cust       = customers.find((c) => c.id === inst.customer_id);
          const photoCount = Object.values(inst.photos || {}).reduce((s, a) => s + (a?.length || 0), 0);
          return (
            <div key={inst.id} onClick={() => onView(inst)} style={{ ...S.card, cursor: "pointer" }}>
              <div style={{ ...S.row, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{cust?.name || "未知客戶"}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {cust?.address ? `📍 ${cust.address}  •  ` : ""}{fmtDate(inst.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {photoCount > 0 && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>📷 {photoCount}</span>}
                  <StatusBadge status={inst.status} />
                </div>
              </div>
              <ProgressStrip stagesData={inst.stages} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstallDetail({ install: initInst, quote, customer, onSave, onUploadPhoto, onDeletePhoto, onBack, showToast }) {
  const [inst,     setInst]     = useState(initInst);
  const [expanded, setExpanded] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [uploading,setUploading]= useState(null);

  const upd = async (updated) => {
    setInst(updated); setSaving(true);
    await onSave(updated);
    setSaving(false);
  };

  const toggleStage = async (stageId, e) => {
    e.stopPropagation();
    const completed = !inst.stages?.[stageId]?.completed;
    const newStages = { ...inst.stages, [stageId]: { ...(inst.stages?.[stageId] || {}), completed, completedAt: completed ? Date.now() : null } };
    const doneCount = STAGES.filter((s) => newStages[s.id]?.completed).length;
    await upd({ ...inst, stages: newStages, status: doneCount === STAGES.length ? "completed" : doneCount > 0 ? "active" : "pending" });
  };

  const saveNote = async (stageId, note) => {
    await upd({ ...inst, stages: { ...inst.stages, [stageId]: { ...(inst.stages?.[stageId] || {}), note } } });
  };

  const handleUpload = async (stageId, files) => {
    setUploading(stageId);
    try {
      const results = await Promise.all(Array.from(files).map((f) => onUploadPhoto(f, inst.id, stageId)));
      const updated = { ...inst, photos: { ...inst.photos, [stageId]: [...(inst.photos?.[stageId] || []), ...results] } };
      await upd(updated);
      showToast(`已上傳 ${results.length} 張照片`);
    } catch (err) {
      showToast("上傳失敗：" + err.message, "error");
    }
    setUploading(null);
  };

  const removePhoto = async (stageId, idx) => {
    const photo = inst.photos?.[stageId]?.[idx];
    if (photo?.path) await onDeletePhoto(photo.path);
    await upd({ ...inst, photos: { ...inst.photos, [stageId]: (inst.photos?.[stageId] || []).filter((_, i) => i !== idx) } });
  };

  const done = STAGES.filter((s) => inst.stages?.[s.id]?.completed).length;
  const pct  = Math.round((done / STAGES.length) * 100);

  return (
    <div>
      <BackBtn onClick={onBack} label="返回安裝進度列表" />
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={{ ...S.row, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: "0 0 3px", fontSize: 17, fontWeight: 600 }}>{customer?.name}</h2>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {customer?.phone && `📞 ${customer.phone}  `}{customer?.address && `📍 ${customer.address}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saving && <span style={{ fontSize: 11, color: "#64748b" }}>儲存中...</span>}
            <StatusBadge status={inst.status} />
          </div>
        </div>
        <div style={{ ...S.row, fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 5 }}>
          <span>進度</span>
          <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{done}/{STAGES.length} ({pct}%)</span>
        </div>
        <div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 4 }}>
          <div style={{ height: "100%", background: "#f59e0b", borderRadius: 4, width: `${pct}%`, transition: "width 0.4s" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {STAGES.map((stage, idx) => {
          const sd     = inst.stages?.[stage.id] || {};
          const photos = inst.photos?.[stage.id] || [];
          const isOpen = expanded === stage.id;
          const isUploading = uploading === stage.id;
          return (
            <div key={stage.id} style={{ ...S.card, padding: 0, border: `0.5px solid ${sd.completed ? "#f59e0b" : "var(--color-border-tertiary)"}`, overflow: "hidden" }}>
              <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : stage.id)}>
                <button onClick={(e) => toggleStage(stage.id, e)} style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${sd.completed ? "#f59e0b" : "var(--color-border-secondary)"}`, background: sd.completed ? "#f59e0b" : "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: sd.completed ? "#0f1f3d" : "var(--color-text-secondary)" }}>
                  {sd.completed ? "✓" : idx + 1}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{stage.label}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    {sd.completed && sd.completedAt ? `完成於 ${fmtDate(sd.completedAt)}` : "尚未完成"}
                    {sd.note ? `  •  ${sd.note}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-secondary)", fontSize: 12 }}>
                  {photos.length > 0 && <span>📷 {photos.length}</span>}
                  <span style={{ fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ paddingTop: 12, marginBottom: 12 }}>
                    <label style={S.label}>施工備註</label>
                    <input defaultValue={sd.note || ""} onBlur={(e) => saveNote(stage.id, e.target.value)} placeholder="記錄施工狀況..." />
                  </div>
                  <div>
                    <div style={{ ...S.row, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>施工照片 ({photos.length})</span>
                      <label style={{ cursor: "pointer", fontSize: 13, padding: "8px 14px", background: "#0f1f3d", color: "white", borderRadius: 7, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {isUploading ? "⏳ 上傳中..." : "📷 拍照 / 上傳"}
                        <input type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={(e) => e.target.files.length && handleUpload(stage.id, e.target.files)} />
                      </label>
                    </div>
                    {photos.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "18px", fontSize: 12, color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", borderRadius: 8 }}>
                        點擊上方按鈕新增施工照片
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                        {photos.map((p, i) => (
                          <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "0.5px solid var(--color-border-tertiary)" }}>
                            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button onClick={() => removePhoto(stage.id, i)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer", color: "white", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.55)", color: "white", fontSize: 9, padding: "3px 4px", textAlign: "center" }}>{fmtDate(p.uploadedAt)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Customers ────────────────────────────────────────────────────────────────

function CustomerList({ customers, onNew, onEdit, onDelete }) {
  return (
    <div>
      <div style={{ ...S.row, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>客戶管理</h2>
        <button onClick={onNew} style={{ background: "#f59e0b", color: "#0f1f3d", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>+ 新增</button>
      </div>
      {customers.length === 0 && <Empty text="尚無客戶" sub="點擊右上角新增" />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {customers.map((c) => (
          <div key={c.id} style={S.card}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#0f1f3d", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 600, fontSize: 17, flexShrink: 0 }}>{c.name?.[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 1 }}>{c.name}</div>
                {c.company && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{c.company}</div>}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => onEdit(c)} style={btnStyle()}>編輯</button>
                <button onClick={() => onDelete(c.id)} style={btnStyle("#fff0f0", "#dc2626", "#fecaca")}>刪除</button>
              </div>
            </div>
            <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {c.phone   && <div style={{ color: "var(--color-text-secondary)" }}>📞 {c.phone}</div>}
              {c.email   && <div style={{ color: "var(--color-text-secondary)" }}>✉ {c.email}</div>}
              {c.address && <div style={{ color: "var(--color-text-secondary)" }}>📍 {c.address}</div>}
              {c.notes   && <div style={{ fontSize: 11, padding: "5px 7px", background: "var(--color-background-secondary)", borderRadius: 4, marginTop: 2 }}>{c.notes}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerForm({ customer, onSave, onBack }) {
  const [f, setF] = useState({ name: customer?.name || "", company: customer?.company || "", phone: customer?.phone || "", email: customer?.email || "", address: customer?.address || "", notes: customer?.notes || "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!f.name.trim()) return alert("請輸入客戶姓名");
    onSave({ id: customer?.id || genId(), ...f, created_at: customer?.created_at || Date.now() });
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <BackBtn onClick={onBack} label="返回客戶列表" />
      <div style={S.card}>
        <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 600 }}>{customer ? "編輯客戶" : "新增客戶"}</h2>
        {[
          { k: "name",    label: "姓名 *",  ph: "客戶姓名" },
          { k: "company", label: "公司",    ph: "公司名稱（選填）" },
          { k: "phone",   label: "電話",    ph: "聯絡電話" },
          { k: "email",   label: "Email",   ph: "電子郵件" },
          { k: "address", label: "安裝地址", ph: "安裝地址" },
        ].map((field) => (
          <Field key={field.k} label={field.label}>
            <input value={f[field.k]} onChange={(e) => set(field.k, e.target.value)} placeholder={field.ph} />
          </Field>
        ))}
        <Field label="備註">
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ resize: "vertical" }} />
        </Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onBack} style={btnStyle()}>取消</button>
          <button onClick={handleSave} style={btnStyle("#f59e0b", "#0f1f3d", "#f59e0b")}>儲存</button>
        </div>
      </div>
    </div>
  );
}
