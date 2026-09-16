import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Boxes, CalendarClock, Package, RefreshCw, TrendingUp } from "lucide-react";
import { apiClient } from "@/api/apiClient";
import PageHeader from "@/components/ui/PageHeader";

const WINDOWS = [
  { value: 30, label: "Last 30 days" },
  { value: 15, label: "Last 15 days" },
  { value: 7, label: "Last 7 days" },
  { value: 1, label: "Today / Daily" },
];

function Metric({ label, value, tone = "blue", icon: Icon, note }) {
  const tones = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700" };
  return <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between"><span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span><span className="font-mono text-2xl font-bold">{value}</span></div>
    <p className="mt-3 text-xs font-semibold text-muted-foreground">{label}</p>{note && <p className="mt-1 text-[11px] text-muted-foreground/70">{note}</p>}
  </div>;
}

export default function AnalysisDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (windowDays = days) => {
    setLoading(true); setError("");
    try { setData(await apiClient.reports.analytics(windowDays)); }
    catch (e) { setError(e.message || "Unable to load analysis"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(days); }, [days]);

  const maxIntake = useMemo(() => Math.max(...(data?.patients?.daily_intake || []).map(d => d.count), 1), [data]);
  const stock = data?.stock || {};
  const operations = data?.operations || {};

  return <div className="page-container">
    <PageHeader title="Analysis Dashboard" subtitle="Operational trends and stock visibility from persisted LifeCare records" icon={BarChart3} className="mb-6" />
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div><p className="text-sm font-semibold">Patient intake summary</p><p className="text-xs text-muted-foreground">Choose the reporting window</p></div>
      <div className="flex flex-wrap gap-2">{WINDOWS.map(w => <button key={w.value} onClick={() => setDays(w.value)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${days === w.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{w.label}</button>)}<button onClick={() => load()} className="rounded-lg border px-3 py-2 text-xs" aria-label="Refresh analysis"><RefreshCw className="h-4 w-4" /></button></div>
    </div>
    {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading && <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">Loading persisted analysis…</div>}
    {!loading && data && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Patients in period" value={data.patients.intake} icon={TrendingUp} />
        <Metric label="# in stock" value={stock.in_stock} icon={Boxes} tone="green" note="Active commodities with stock" />
        <Metric label="# issued" value={stock.issued} icon={Package} tone="blue" note="Dispensed units in period" />
        <Metric label="# first to expire" value={stock.first_to_expire?.drug || "—"} icon={CalendarClock} tone="amber" note={stock.first_to_expire?.expiry_date || "No active batches"} />
        <Metric label="# low stock" value={stock.low_stock} icon={AlertTriangle} tone="amber" />
        <Metric label="# out of stock" value={stock.out_of_stock} icon={Package} tone="red" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Patient intake</h2><p className="text-xs text-muted-foreground">{data.period.start} to {data.period.end}</p></div><CalendarClock className="h-5 w-5 text-primary" /></div><div className="flex h-44 items-end gap-1 border-b border-l p-3">{data.patients.daily_intake.map(d => <div key={d.date} className="group flex h-full flex-1 items-end" title={`${d.date}: ${d.count}`}><div className="w-full rounded-t bg-primary/70 group-hover:bg-primary" style={{ height: `${Math.max((d.count / maxIntake) * 100, d.count ? 5 : 0)}%` }} /></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Total registrations: <span className="font-semibold text-foreground">{data.patients.intake}</span></p></section>
        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Essential commodities</h2><p className="text-xs text-muted-foreground">Stock balances and nearest available expiry</p></div><Package className="h-5 w-5 text-orange-600" /></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b text-muted-foreground"><tr><th className="pb-2">Commodity</th><th className="pb-2">Category</th><th className="pb-2 text-right">In stock</th><th className="pb-2">First expiry</th><th className="pb-2">Status</th></tr></thead><tbody>{stock.commodities.map(c => <tr key={c.id} className="border-b last:border-0"><td className="py-3 font-medium">{c.name}<span className="block text-[10px] text-muted-foreground">{c.generic_name || c.unit}</span></td><td className="py-3 text-muted-foreground">{c.category || "—"}</td><td className="py-3 text-right font-mono">{c.quantity}</td><td className="py-3">{c.expiry_date || "—"}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${c.status === "out_of_stock" ? "bg-red-50 text-red-700" : c.status === "low_stock" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{c.status.replaceAll("_", " ")}</span></td></tr>)}</tbody></table>{stock.commodities.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No active commodities recorded.</p>}</div></section>
      </div>
      <div className="mt-6 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><h2 className="mb-4 font-semibold">Operational snapshot</h2><div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4"><div><p className="text-2xl font-bold">{operations.encounters}</p><p className="text-xs text-muted-foreground">Encounters</p></div><div><p className="text-2xl font-bold">{operations.lab_orders}</p><p className="text-xs text-muted-foreground">Lab orders</p></div><div><p className="text-2xl font-bold">{operations.prescription_items}</p><p className="text-xs text-muted-foreground">Prescription items</p></div><div><p className="text-2xl font-bold">{operations.paid_revenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Paid revenue (MWK)</p></div></div></div>
      <p className="mt-4 text-[11px] text-muted-foreground">As of {new Date(data.as_of).toLocaleString()} · Counts are read-only and may include demo data if the database was seeded.</p>
    </>}
  </div>;
}
