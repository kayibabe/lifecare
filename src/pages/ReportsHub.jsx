import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  BedDouble,
  CalendarClock,
  Download,
  FileBarChart,
  Package,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
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

function downloadBundle(bundle, days) {
  const safeBundle = {
    generated_at: new Date().toISOString(),
    period_days: days,
    ...bundle,
    providers: bundle.providers
      ? { ...bundle.providers, providers: bundle.providers.providers.map(({ provider_id, ...provider }) => provider) }
      : undefined,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(safeBundle, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `lifecare-report-bundle-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsHub() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [clinical, setClinical] = useState(null);
  const [finance, setFinance] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [flow, setFlow] = useState(null);
  const [quality, setQuality] = useState(null);
  const [providers, setProviders] = useState(null);
  const [audit, setAudit] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [diagnoses, setDiagnoses] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [inpatient, setInpatient] = useState(null);
  const [theatreMortuary, setTheatreMortuary] = useState(null);
  const [dental, setDental] = useState(null);
  const [nursingOperations, setNursingOperations] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (windowDays = days) => {
    setLoading(true); setError("");
    try {
      const currentUser = await apiClient.auth.me();
      const requests = {
        data: apiClient.reports.analytics(windowDays),
        clinical: apiClient.reports.clinicalActivity(windowDays),
        flow: apiClient.reports.patientFlow(windowDays),
        comparison: apiClient.reports.comparison(windowDays),
        referrals: apiClient.reports.referrals(windowDays),
        inpatient: apiClient.reports.inpatient(windowDays),
        theatreMortuary: apiClient.reports.theatreMortuary(windowDays),
      };
      if (["admin", "cashier", "billing_clerk"].includes(currentUser?.role)) requests.finance = apiClient.reports.financeSummary(windowDays);
      if (["admin", "pharmacist", "store_manager"].includes(currentUser?.role)) requests.pharmacy = apiClient.reports.pharmacySummary(windowDays);
      if (currentUser?.role === "admin") {
        requests.quality = apiClient.reports.dataQuality();
        requests.providers = apiClient.reports.providerPerformance(windowDays);
        requests.audit = apiClient.reports.auditSummary(windowDays);
      }
      requests.demographics = apiClient.reports.demographics();
      if (["admin", "doctor", "clinician"].includes(currentUser?.role)) requests.diagnoses = apiClient.reports.diagnoses(windowDays);
      if (["admin", "doctor", "dentist", "clinician"].includes(currentUser?.role)) requests.dental = apiClient.reports.dental(windowDays);
      if (["admin", "doctor", "nurse", "clinician"].includes(currentUser?.role)) requests.nursingOperations = apiClient.reports.nursingOperations(windowDays);
      const entries = Object.entries(requests);
      const results = await Promise.allSettled(entries.map(([, request]) => request));
      const values = {};
      const failures = [];
      results.forEach((result, index) => {
        const [key] = entries[index];
        if (result.status === "fulfilled") values[key] = result.value;
        else failures.push(key);
      });
      setData(values.data || null); setClinical(values.clinical || null); setFinance(values.finance || null); setPharmacy(values.pharmacy || null); setFlow(values.flow || null); setQuality(values.quality || null); setProviders(values.providers || null); setAudit(values.audit || null); setDemographics(values.demographics || null); setDiagnoses(values.diagnoses || null); setComparison(values.comparison || null); setReferrals(values.referrals || null); setInpatient(values.inpatient || null); setTheatreMortuary(values.theatreMortuary || null); setDental(values.dental || null); setNursingOperations(values.nursingOperations || null); setUser(currentUser);
      if (failures.length) setError(`Some report sections could not be loaded: ${failures.join(", ")}. Retry to refresh them.`);
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
      <button onClick={() => downloadBundle({ data, clinical, finance, pharmacy, flow, quality, providers, audit, demographics, diagnoses, comparison, referrals, inpatient, theatreMortuary, dental, nursingOperations }, days)} disabled={!data || loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
        <Download className="h-4 w-4" /> Export bundle
      </button>
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
          <div><p className="text-2xl font-bold">{Number(finance.invoices.outstanding_balance).toLocaleString()} MWK</p><p className="text-xs text-muted-foreground">Outstanding balance</p><p className="mt-2 text-[11px] text-muted-foreground">0–30d: {Number(finance.invoices.aging["0_30_days"]).toLocaleString()} MWK</p></div>
          <div><p className="text-2xl font-bold">{Number(finance.claims.claimed_total).toLocaleString()} MWK</p><p className="text-xs text-muted-foreground">Insurance claims</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(finance.claims.by_status).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No claims"}</p></div>
        </div><div className="mt-5 border-t pt-4"><p className="mb-2 text-xs font-semibold text-muted-foreground">Receivables aging</p><div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">{Object.entries(finance.invoices.aging).map(([key, value]) => <div key={key} className="rounded-lg bg-muted/30 p-3"><p className="font-semibold">{key.replaceAll("_", " ")}</p><p className="mt-1 font-mono">{Number(value).toLocaleString()} MWK</p></div>)}</div></div>
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
      {flow && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Patient flow and scheduling</h2><p className="text-xs text-muted-foreground">Appointments and encounter queues for {flow.period.start} to {flow.period.end}</p></div><CalendarClock className="h-5 w-5 text-primary" /></div>
        <div className="grid gap-6 md:grid-cols-4">
          <div><p className="text-2xl font-bold">{flow.appointments.total}</p><p className="text-xs text-muted-foreground">Appointments</p><p className="mt-2 text-[11px] text-muted-foreground">{flow.appointments.completed} completed</p></div>
          <div><p className="text-2xl font-bold">{flow.appointments.no_shows}</p><p className="text-xs text-muted-foreground">No-shows</p><p className="mt-2 text-[11px] text-muted-foreground">{flow.appointments.no_show_rate === null ? "No appointments" : `${(flow.appointments.no_show_rate * 100).toFixed(1)}% of appointments`}</p></div>
          <div><p className="text-2xl font-bold">{flow.encounters.total}</p><p className="text-xs text-muted-foreground">Encounters</p></div>
          <div><p className="text-2xl font-bold">{Object.keys(flow.appointments.by_type).length}</p><p className="text-xs text-muted-foreground">Appointment types</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(flow.appointments.by_type).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No appointments"}</p></div>
        </div>
      </section>}
      {quality && <section className={`mt-8 rounded-xl border p-5 shadow-sm ${quality.status === "clear" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Data quality and readiness</h2><p className="text-xs text-muted-foreground">Current-state checks affecting report confidence</p></div><ShieldCheck className="h-5 w-5 text-primary" /></div>
        <div className="grid gap-6 md:grid-cols-4"><div><p className="text-2xl font-bold">{quality.issue_count}</p><p className="text-xs text-muted-foreground">Recorded quality flags</p></div><div><p className="text-2xl font-bold">{quality.checks.patients_missing_consent}</p><p className="text-xs text-muted-foreground">Patients missing consent</p></div><div><p className="text-2xl font-bold">{quality.checks.appointments_without_provider}</p><p className="text-xs text-muted-foreground">Unassigned appointments</p></div><div><p className="text-2xl font-bold">{quality.checks.lab_orders_pending_result}</p><p className="text-xs text-muted-foreground">Pending lab results</p></div></div>
        <p className="mt-4 text-[11px] text-muted-foreground">These flags identify completeness gaps; they do not invalidate or correct the underlying records automatically.</p>
      </section>}
      {providers && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Provider performance</h2><p className="text-xs text-muted-foreground">Recorded workload for {providers.period.start} to {providers.period.end}</p></div><Activity className="h-5 w-5 text-primary" /></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b text-muted-foreground"><tr><th className="pb-2">Provider</th><th className="pb-2 text-right">Encounters</th><th className="pb-2 text-right">Closed</th><th className="pb-2 text-right">Appointments</th><th className="pb-2 text-right">Completed</th><th className="pb-2 text-right">No-shows</th></tr></thead><tbody>{providers.providers.map(provider => <tr key={provider.provider_id} className="border-b last:border-0"><td className="py-3 font-medium">{provider.provider_name}</td><td className="py-3 text-right">{provider.encounters}</td><td className="py-3 text-right">{provider.closed_encounters}</td><td className="py-3 text-right">{provider.appointments}</td><td className="py-3 text-right">{provider.completed_appointments}</td><td className="py-3 text-right">{provider.no_shows}</td></tr>)}</tbody></table>{providers.providers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No provider-attributed activity in this period.</p>}</div><p className="mt-4 text-[11px] text-muted-foreground">Recorded workload is not a clinical quality or patient-outcome assessment.</p></section>}
      {audit && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Audit activity</h2><p className="text-xs text-muted-foreground">Administrative activity during the last {audit.period.days} days</p></div><ShieldCheck className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-4"><div><p className="text-2xl font-bold">{audit.total_events}</p><p className="text-xs text-muted-foreground">Audit events</p></div><div><p className="text-2xl font-bold">{audit.active_users}</p><p className="text-xs text-muted-foreground">Active users recorded</p></div><div><p className="text-2xl font-bold">{Object.keys(audit.by_action).length}</p><p className="text-xs text-muted-foreground">Action types</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(audit.by_action).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No events"}</p></div><div><p className="text-2xl font-bold">{Object.keys(audit.by_entity).length}</p><p className="text-xs text-muted-foreground">Entity types</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(audit.by_entity).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No events"}</p></div></div><p className="mt-4 text-[11px] text-muted-foreground">Payload details are intentionally excluded here; use Audit Logs for authorized review.</p></section>}
      {demographics && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Patient demographics</h2><p className="text-xs text-muted-foreground">Aggregate profile of {demographics.total_patients} active patients</p></div><Users className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-3"><div><h3 className="mb-2 text-xs font-semibold text-muted-foreground">Gender</h3>{Object.entries(demographics.by_gender).map(([key, value]) => <p key={key} className="flex justify-between border-b py-1.5 text-xs"><span className="capitalize">{key}</span><span className="font-semibold">{value}</span></p>)}</div><div><h3 className="mb-2 text-xs font-semibold text-muted-foreground">Age bands</h3>{Object.entries(demographics.by_age_band).map(([key, value]) => <p key={key} className="flex justify-between border-b py-1.5 text-xs"><span>{key}</span><span className="font-semibold">{value}</span></p>)}</div><div><h3 className="mb-2 text-xs font-semibold text-muted-foreground">Top districts</h3>{Object.entries(demographics.by_district).slice(0, 6).map(([key, value]) => <p key={key} className="flex justify-between border-b py-1.5 text-xs"><span className="truncate pr-2">{key}</span><span className="font-semibold">{value}</span></p>)}{Object.keys(demographics.by_district).length === 0 && <p className="text-xs text-muted-foreground">No district data recorded.</p>}</div></div></section>}
      {diagnoses && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Clinical diagnosis profile</h2><p className="text-xs text-muted-foreground">Structured diagnoses recorded during the selected period</p></div><Activity className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]"><div><p className="text-2xl font-bold">{diagnoses.consultations_with_structured_diagnosis}</p><p className="text-xs text-muted-foreground">Consultations with structured diagnosis</p><p className="mt-2 text-[11px] text-muted-foreground">{diagnoses.consultations_without_structured_diagnosis} without structured diagnosis</p></div><div className="space-y-2">{diagnoses.top_diagnoses.slice(0, 8).map(item => <div key={item.label} className="flex items-center justify-between border-b pb-1.5 text-xs"><span className="truncate pr-2">{item.label}</span><span className="font-semibold">{item.count}</span></div>)}{diagnoses.top_diagnoses.length === 0 && <p className="text-xs text-muted-foreground">No structured diagnoses recorded.</p>}</div></div><p className="mt-4 text-[11px] text-muted-foreground">Free-text assessment is excluded; this is an aggregate documentation profile, not a clinical quality assessment.</p></section>}
      {comparison && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Period comparison</h2><p className="text-xs text-muted-foreground">Current period versus the preceding {days} days</p></div><TrendingUp className="h-5 w-5 text-primary" /></div><div className="grid grid-cols-2 gap-4 md:grid-cols-5">{[["patients", "Patients"], ["encounters", "Encounters"], ["lab_orders", "Lab orders"], ["prescription_items", "Prescription items"], ["paid_revenue", "Paid revenue"]].map(([key, label]) => <div key={key}><p className="text-lg font-bold">{comparison.current[key] === null ? "Restricted" : Number(comparison.current[key]).toLocaleString()}</p><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-[11px] font-semibold ${comparison.change[key] === null ? "text-muted-foreground" : comparison.change[key] >= 0 ? "text-emerald-700" : "text-red-700"}`}>{comparison.change[key] === null ? "Not comparable" : `${comparison.change[key] >= 0 ? "+" : ""}${Number(comparison.change[key]).toLocaleString()} vs previous`}</p></div>)}</div></section>}
      {referrals && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Referral activity</h2><p className="text-xs text-muted-foreground">Aggregate handoffs for {referrals.period.start} to {referrals.period.end}</p></div><ArrowRightLeft className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-4"><div><p className="text-2xl font-bold">{referrals.total_referrals}</p><p className="text-xs text-muted-foreground">Referrals</p></div><div><p className="text-2xl font-bold">{referrals.feedback_recorded}</p><p className="text-xs text-muted-foreground">Feedback recorded</p></div><div><p className="text-2xl font-bold">{Object.keys(referrals.by_status).length}</p><p className="text-xs text-muted-foreground">Status types</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(referrals.by_status).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No referrals"}</p></div><div><p className="text-2xl font-bold">{Object.keys(referrals.by_destination).length}</p><p className="text-xs text-muted-foreground">Destination facilities</p><p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(referrals.by_destination).slice(0, 2).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No destinations"}</p></div></div></section>}
      {inpatient && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Inpatient and bed occupancy</h2><p className="text-xs text-muted-foreground">Ward activity for {inpatient.period.start} to {inpatient.period.end}</p></div><BedDouble className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-4"><div><p className="text-2xl font-bold">{inpatient.admissions}</p><p className="text-xs text-muted-foreground">Admissions</p></div><div><p className="text-2xl font-bold">{inpatient.discharges}</p><p className="text-xs text-muted-foreground">Discharges</p></div><div><p className="text-2xl font-bold">{inpatient.active_admissions}</p><p className="text-xs text-muted-foreground">Active admissions</p></div><div><p className="text-2xl font-bold">{inpatient.occupancy.occupancy_rate === null ? "—" : `${(inpatient.occupancy.occupancy_rate * 100).toFixed(1)}%`}</p><p className="text-xs text-muted-foreground">Current occupancy</p><p className="mt-2 text-[11px] text-muted-foreground">{inpatient.occupancy.occupied_beds} / {inpatient.occupancy.total_beds} beds</p></div></div><div className="mt-5 grid gap-2 md:grid-cols-3">{inpatient.occupancy.wards.map(ward => <div key={ward.ward} className="rounded-lg bg-muted/30 p-3 text-xs"><p className="font-semibold">{ward.ward}</p><p className="mt-1 text-muted-foreground">{ward.occupied} / {ward.capacity} occupied</p></div>)}</div></section>}
      {theatreMortuary && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Theatre and mortuary</h2><p className="text-xs text-muted-foreground">Aggregate activity for {theatreMortuary.period.start} to {theatreMortuary.period.end}</p></div><Activity className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-4"><div><p className="text-2xl font-bold">{theatreMortuary.theatre.cases}</p><p className="text-xs text-muted-foreground">Theatre cases</p></div><div><p className="text-2xl font-bold">{theatreMortuary.theatre.completed_cases}</p><p className="text-xs text-muted-foreground">Completed cases</p></div><div><p className="text-2xl font-bold">{theatreMortuary.mortuary.active_intakes}</p><p className="text-xs text-muted-foreground">Active mortuary intakes</p></div><div><p className="text-2xl font-bold">{theatreMortuary.mortuary.family_notification_pending}</p><p className="text-xs text-muted-foreground">Notification pending</p></div></div><div className="mt-5 grid gap-2 md:grid-cols-3"><div className="rounded-lg bg-muted/30 p-3 text-xs"><p className="font-semibold">Theatre rooms</p><p className="mt-1 text-muted-foreground">{Object.entries(theatreMortuary.theatre.by_room).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No cases"}</p></div><div className="rounded-lg bg-muted/30 p-3 text-xs"><p className="font-semibold">Case statuses</p><p className="mt-1 text-muted-foreground">{Object.entries(theatreMortuary.theatre.by_status).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No cases"}</p></div><div className="rounded-lg bg-muted/30 p-3 text-xs"><p className="font-semibold">Mortuary period</p><p className="mt-1 text-muted-foreground">{theatreMortuary.mortuary.deaths_recorded} deaths · {theatreMortuary.mortuary.intakes} intakes · {theatreMortuary.mortuary.released_intakes} released</p></div></div></section>}
      {dental && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Dental services</h2><p className="text-xs text-muted-foreground">Aggregate activity for {dental.period.start} to {dental.period.end}</p></div><Activity className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-4"><div><p className="text-2xl font-bold">{dental.encounters.total}</p><p className="text-xs text-muted-foreground">Dental encounters</p></div><div><p className="text-2xl font-bold">{dental.treatment_plans.total}</p><p className="text-xs text-muted-foreground">Treatment plans</p></div><div><p className="text-2xl font-bold">{dental.tooth_findings.total}</p><p className="text-xs text-muted-foreground">Structured findings</p></div><div><p className="text-2xl font-bold">{Number(dental.treatment_plans.estimated_value).toLocaleString()}</p><p className="text-xs text-muted-foreground">Estimated plan value</p></div></div><p className="mt-4 text-xs text-muted-foreground">Encounter statuses: {Object.entries(dental.encounters.by_status).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No encounters"}</p></section>}
      {nursingOperations && <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Nursing and operations</h2><p className="text-xs text-muted-foreground">Documentation, MAR, roster and handover aggregates for {nursingOperations.period.start} to {nursingOperations.period.end}</p></div><Activity className="h-5 w-5 text-primary" /></div><div className="grid gap-6 md:grid-cols-4"><div><p className="text-2xl font-bold">{nursingOperations.nursing.vital_sign_records}</p><p className="text-xs text-muted-foreground">Vital-sign records</p></div><div><p className="text-2xl font-bold">{nursingOperations.nursing.medication_administrations}</p><p className="text-xs text-muted-foreground">MAR records</p></div><div><p className="text-2xl font-bold">{nursingOperations.roster.scheduled_shifts}</p><p className="text-xs text-muted-foreground">Scheduled shifts</p></div><div><p className="text-2xl font-bold">{nursingOperations.handovers.doctor_acknowledged + nursingOperations.handovers.shift_acknowledged}</p><p className="text-xs text-muted-foreground">Acknowledged handovers</p></div></div><p className="mt-4 text-xs text-muted-foreground">MAR statuses: {Object.entries(nursingOperations.nursing.mar_by_status).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No MAR records"} · Handover notes: {nursingOperations.nursing.handover_notes}</p></section>}
      <p className="mt-6 text-[11px] text-muted-foreground">As of {data.as_of ? new Date(data.as_of).toLocaleString() : "now"}. Reports are read-only; seeded or demo records may be included where present.</p>
    </>}
  </div>;
}
