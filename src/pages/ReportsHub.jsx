import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Download,
  FileBarChart,
  Package,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { apiClient } from "@/api/apiClient";
import PageHeader from "@/components/ui/PageHeader";

const WINDOWS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const REPORTS = [
  { title: "Operational analysis", description: "Patient intake, encounters, laboratories, prescriptions and stock trends.", path: "/analysis", icon: BarChart3, roles: ["admin", "user"] },
  { title: "Revenue and billing", description: "Payments, invoices, claims and revenue reporting.", path: "/billing?tab=reports", icon: WalletCards, roles: ["admin", "user", "cashier", "receptionist"] },
  { title: "Audit and compliance", description: "Review system activity and clinical audit records.", path: "/audit-logs", icon: ShieldCheck, roles: ["admin"] },
  { title: "Stock analysis", description: "Current commodities, low-stock items and nearest expiry visibility.", path: "/analysis", icon: Package, roles: ["admin", "user"] },
];

function Metric({ label, value, note, tone = "blue" }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-violet-50 text-violet-700",
  };
  return <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
    <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${styles[tone]}`}>{label}</span>
    <p className="mt-3 text-2xl font-bold font-mono">{value}</p>
    {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
  </div>;
}

function downloadSummary(data, days) {
  const rows = [
    ["Metric", "Value"],
    ["Reporting window (days)", days],
    ["Patients registered", data?.patients?.intake ?? 0],
    ["Encounters", data?.operations?.encounters ?? 0],
    ["Lab orders", data?.operations?.lab_orders ?? 0],
    ["Prescription items", data?.operations?.prescription_items ?? 0],
    ["Paid revenue (MWK)", data?.operations?.paid_revenue],
    ["Items in stock", data?.stock?.in_stock ?? 0],
    ["Low-stock items", data?.stock?.low_stock ?? 0],
    ["Out-of-stock items", data?.stock?.out_of_stock ?? 0],
  ];
  const csv = rows.map(row => row.map(value => JSON.stringify(value ?? "")).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `lifecare-report-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsHub() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [clinical, setClinical] = useState(null);
  const [finance, setFinance] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (windowDays = days) => {
    setLoading(true); setError("");
    try {
      const currentUser = await apiClient.auth.me();
      const [analytics, clinicalActivity] = await Promise.all([
        apiClient.reports.analytics(windowDays),
        apiClient.reports.clinicalActivity(windowDays),
      ]);
      const financeSummary = ["admin", "cashier", "billing_clerk"].includes(currentUser?.role)
        ? await apiClient.reports.financeSummary(windowDays)
        : null;
      const pharmacySummary = ["admin", "pharmacist", "store_manager"].includes(currentUser?.role)
        ? await apiClient.reports.pharmacySummary(windowDays)
        : null;
      setData(analytics); setClinical(clinicalActivity); setFinance(financeSummary); setPharmacy(pharmacySummary); setUser(currentUser);
    } catch (e) {
      setError(e?.message || "Unable to load the reports summary.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(days); }, [days]);

  const visibleReports = useMemo(() => {
    const role = user?.role || "user";
    return REPORTS.filter(report => report.roles.includes(role));
  }, [user]);

  const operations = data?.operations || {};
  const stock = data?.stock || {};

  return <div className="page-container">
    <PageHeader title="Reports" subtitle="One place to review LifeCare performance, operations and compliance" icon={FileBarChart} className="mb-6">
      <button onClick={() => downloadSummary(data, days)} disabled={!data || loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
        <Download className="h-4 w-4" /> Export summary
      </button>
    </PageHeader>

    <section className="mb-6 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">Facility snapshot</p><p className="text-xs text-muted-foreground">Read-only metrics from persisted LifeCare records</p></div>
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map(window => <button key={window.value} onClick={() => setDays(window.value)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${days === window.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{window.label}</button>)}
          <button onClick={() => load()} disabled={loading} aria-label="Refresh reports" className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>
    </section>

    {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading && <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">Loading persisted report data…</div>}
    {!loading && data && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Patients" value={data.patients?.intake ?? 0} note={`Last ${days} days`} />
        <Metric label="Encounters" value={operations.encounters ?? 0} tone="green" />
        <Metric label="Lab orders" value={operations.lab_orders ?? 0} tone="purple" />
        {user?.role && ["admin", "cashier", "billing_clerk"].includes(user.role) && <Metric label="Revenue" value={`${Number(operations.paid_revenue ?? 0).toLocaleString()} MWK`} tone="green" />}
        <Metric label="Low stock" value={stock.low_stock ?? 0} note="Needs review" tone="amber" />
        <Metric label="Out of stock" value={stock.out_of_stock ?? 0} note="Needs action" tone="amber" />
      </div>
      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Available reports</h2><p className="text-xs text-muted-foreground">Open a detailed report for your role</p></div></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleReports.map(report => { const Icon = report.icon; return <Link key={report.path} to={report.path} className="group rounded-xl border border-border/60 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="mb-4 flex items-start justify-between"><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span><span className="text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">Open →</span></div><h3 className="font-semibold">{report.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{report.description}</p></Link>; })}
        </div>
      </section>
      {clinical && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Clinical activity</h2><p className="text-xs text-muted-foreground">Aggregate workload for {clinical.period.start} to {clinical.period.end}</p></div><Activity className="h-5 w-5 text-primary" /></div>
        <div className="grid gap-6 md:grid-cols-4">
          <div><p className="text-2xl font-bold">{clinical.patients.new_registrations}</p><p className="text-xs text-muted-foreground">New registrations</p></div>
          <div><p className="text-2xl font-bold">{clinical.encounters.total}</p><p className="text-xs text-muted-foreground">Encounters</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(clinical.encounters.by_type).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No encounters"}</p></div>
          <div><p className="text-2xl font-bold">{clinical.laboratory.orders}</p><p className="text-xs text-muted-foreground">Laboratory orders</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(clinical.laboratory.by_priority).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No orders"}</p></div>
          <div><p className="text-2xl font-bold">{clinical.prescriptions.total}</p><p className="text-xs text-muted-foreground">Prescriptions</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(clinical.patients.by_gender).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No registrations"}</p></div>
        </div>
      </section>}
      {finance && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Finance and claims</h2><p className="text-xs text-muted-foreground">Aggregate finance activity for {finance.period.start} to {finance.period.end}</p></div><WalletCards className="h-5 w-5 text-primary" /></div>
        <div className="grid gap-6 md:grid-cols-4">
          <div><p className="text-2xl font-bold">{Number(finance.payments.collected_total).toLocaleString()} MWK</p><p className="text-xs text-muted-foreground">Collected payments</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(finance.payments.by_method).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No payments"}</p></div>
          <div><p className="text-2xl font-bold">{Number(finance.invoices.gross_total).toLocaleString()} MWK</p><p className="text-xs text-muted-foreground">Invoiced</p><p className="mt-2 text-[11px] text-muted-foreground">{finance.invoices.count} invoice{finance.invoices.count === 1 ? "" : "s"}</p></div>
          <div><p className="text-2xl font-bold">{Number(finance.invoices.outstanding_balance).toLocaleString()} MWK</p><p className="text-xs text-muted-foreground">Outstanding balance</p></div>
          <div><p className="text-2xl font-bold">{Number(finance.claims.claimed_total).toLocaleString()} MWK</p><p className="text-xs text-muted-foreground">Insurance claims</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(finance.claims.by_status).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No claims"}</p></div>
        </div>
      </section>}
      {pharmacy && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Pharmacy and inventory</h2><p className="text-xs text-muted-foreground">Stock position and dispensing activity for {pharmacy.period.start} to {pharmacy.period.end}</p></div><Package className="h-5 w-5 text-primary" /></div>
        <div className="grid gap-6 md:grid-cols-4">
          <div><p className="text-2xl font-bold">{pharmacy.inventory.total_units.toLocaleString()}</p><p className="text-xs text-muted-foreground">Units currently in stock</p><p className="mt-2 text-[11px] text-muted-foreground">{pharmacy.inventory.active_medicines} active medicines</p></div>
          <div><p className="text-2xl font-bold">{pharmacy.dispensing.units_dispensed.toLocaleString()}</p><p className="text-xs text-muted-foreground">Units dispensed</p><p className="mt-2 text-[11px] text-muted-foreground">{pharmacy.dispensing.line_items} dispensing line items</p></div>
          <div><p className="text-2xl font-bold">{pharmacy.inventory.low_stock_medicines + pharmacy.inventory.out_of_stock_medicines}</p><p className="text-xs text-muted-foreground">Medicines needing action</p><p className="mt-2 text-[11px] text-muted-foreground">{pharmacy.inventory.low_stock_medicines} low · {pharmacy.inventory.out_of_stock_medicines} out</p></div>
          <div><p className="text-2xl font-bold">{pharmacy.inventory.expiry_risk.expired + pharmacy.inventory.expiry_risk.within_30_days}</p><p className="text-xs text-muted-foreground">Expiry-risk batches</p><p className="mt-2 text-[11px] text-muted-foreground">{pharmacy.inventory.expiry_risk.expired} expired · {pharmacy.inventory.expiry_risk.within_30_days} within 30 days</p></div>
        </div>
      </section>}
      <p className="mt-6 text-[11px] text-muted-foreground">As of {data.as_of ? new Date(data.as_of).toLocaleString() : "now"}. Reports are read-only; seeded or demo records may be included where present.</p>
    </>}
  </div>;
}
