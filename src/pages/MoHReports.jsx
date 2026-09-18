import { useEffect, useState } from "react";
import { Download, FileBarChart, Loader2, ShieldAlert } from "lucide-react";
import { apiClient } from "@/api/apiClient";
import PageHeader from "@/components/ui/PageHeader";

const METRICS = [
  ["total_visits", "Total visits"],
  ["opd_visits", "OPD visits"],
  ["emergency_visits", "Emergency visits"],
  ["inpatient_admissions", "Inpatient admissions"],
  ["total_lab_orders", "Laboratory orders"],
  ["new_patient_registrations", "New registrations"],
];

function downloadReport(data, format) {
  const rows = [["Indicator", "Value"], ...METRICS.map(([key, label]) => [label, data.aggregates[key] ?? ""])];
  const content = format === "json"
    ? JSON.stringify(data, null, 2)
    : rows.map(row => row.map(value => JSON.stringify(value ?? "")).join(",")).join("\n");
  const type = format === "json" ? "application/json" : "text/csv;charset=utf-8";
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `lifecare-moh-${data.period}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MoHReports() {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState(null);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setError("");
    try {
      const result = await apiClient.reports.createMohExport(period);
      setReport(result.report);
      setExports(await apiClient.reports.mohExports(period));
    }
    catch (e) { setError(e?.message || "Unable to generate the monthly report."); }
    finally { setLoading(false); }
  };

  useEffect(() => { generate(); }, []);

  return <div className="page-container">
    <PageHeader title="MoH & DHIS2 Reporting" subtitle="Traceable monthly aggregate preparation from LifeCare records" icon={FileBarChart} className="mb-6">
      <input type="month" value={period} onChange={event => setPeriod(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <button onClick={generate} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"><Download className="h-4 w-4" />{loading ? "Generating…" : "Generate report"}</button>
    </PageHeader>
    {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading && !report && <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading monthly aggregate…</div>}
    {report && <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{METRICS.map(([key, label]) => <div key={key} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"><p className="text-2xl font-bold">{report.aggregates[key] ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
      <div className="mb-6 flex gap-2"><button onClick={() => downloadReport(report, "json")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted"><Download className="h-4 w-4" />JSON</button><button onClick={() => downloadReport(report, "csv")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted"><Download className="h-4 w-4" />CSV</button></div>
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" /><div><h2 className="font-semibold text-amber-900">Submission readiness and limitations</h2><p className="mt-1 text-xs leading-5 text-amber-800">This payload is prepared from: {report.quality.source_tables.join(", ")}. It is not submitted to DHIS2 automatically.</p><ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-amber-800">{report.limitations.map(item => <li key={item}>{item}</li>)}</ul></div></div></section>
      <p className="mt-4 text-[11px] text-muted-foreground">Generated {new Date(report.generated_at).toLocaleString()} · Period {report.period} · Verify facility mappings before external submission.</p>
      <section className="mt-8 rounded-xl border border-border/60 bg-card p-5 shadow-sm"><h2 className="mb-4 font-semibold">Export history</h2>{exports.length === 0 ? <p className="text-xs text-muted-foreground">No saved exports for this period.</p> : <div className="space-y-2">{exports.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs"><span>{new Date(item.created_at).toLocaleString()} · {item.source_revision}</span><span className="font-mono text-muted-foreground">SHA-256 {item.payload_hash.slice(0, 12)}…</span></div>)}</div>}</section>
    </>}
  </div>;
}
