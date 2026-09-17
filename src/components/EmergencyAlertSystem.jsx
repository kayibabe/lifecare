import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/apiClient";
import { getToken } from "@/api/customClient";
import { AlertTriangle, Bell, Clock, X } from "lucide-react";

const ageInMinutes = (value) => {
  if (!value) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? "now" : `${minutes}m ago`;
};

export default function EmergencyAlertSystem() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());

  const loadAlerts = async () => {
    if (!getToken()) return;
    try {
      const [visits, labResults, drugs] = await Promise.all([
        apiClient.entities.Visit.filter({ encounter_type: "emergency", queue_status: { $in: ["waiting", "triaged", "in_consultation"] } }, "-created_date", 50),
        apiClient.entities.LabResult.filter({ is_critical: true, status: "critical" }, "-created_date", 50),
        apiClient.entities.Drug.filter({ quantity_in_stock: { $lte: 5 } }, "", 50),
      ]);
      setAlerts([
        ...visits.map((visit) => ({ id: `emergency-${visit.id}`, type: "emergency", title: "Emergency patient waiting", message: `Patient ${visit.patient_id?.slice(0, 8) || "unknown"} — emergency encounter`, time: visit.created_date })),
        ...labResults.map((result) => ({ id: `lab-${result.id}`, type: "critical", title: "Critical lab result", message: `${result.test_name}: ${result.result_value} (critical)`, time: result.created_date })),
        ...drugs.map((drug) => ({ id: `inventory-${drug.id}`, type: "critical", title: "Critical inventory", message: `${drug.name} stock: ${drug.quantity_in_stock}`, time: drug.updated_date })),
      ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)));
    } catch (error) {
      console.error("Unable to load global alerts", error);
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const visibleAlerts = useMemo(() => alerts.filter((alert) => !dismissed.has(alert.id)), [alerts, dismissed]);
  const emergencyAlerts = visibleAlerts.filter((alert) => alert.type === "emergency");
  const criticalAlerts = visibleAlerts.filter((alert) => alert.type === "critical");
  const dismiss = (id) => setDismissed((previous) => new Set([...previous, id]));

  const renderBell = (kind, items, label, iconClass, badgeClass) => {
    const isOpen = open === kind;
    return (
      <div className="relative">
        <button type="button" onClick={() => setOpen(isOpen ? null : kind)} className={`relative rounded-lg p-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${items.length ? iconClass : "text-muted-foreground"} ${kind === "emergency" && items.length ? "animate-pulse" : ""}`} aria-label={`${label}: ${items.length}`} aria-expanded={isOpen} title={`${label}: ${items.length}`}>
          <Bell className="h-5 w-5" />
          {items.length > 0 && <span className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${badgeClass}`}>{items.length > 99 ? "99+" : items.length}</span>}
        </button>
        {isOpen && (
          <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2"><Bell className={`h-4 w-4 ${iconClass}`} /><p className="text-xs font-bold uppercase tracking-wider">{label}</p></div>
              <button type="button" onClick={() => setOpen(null)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close alerts"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
              {items.length === 0 ? <p className="px-4 py-6 text-center text-xs text-muted-foreground">No active {label.toLowerCase()}.</p> : items.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 border-b border-border/40 px-4 py-3 last:border-0">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{alert.title}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{alert.message}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/70"><Clock className="h-3 w-3" />{ageInMinutes(alert.time)}</p></div>
                  <button type="button" onClick={() => dismiss(alert.id)} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Dismiss ${alert.title}`}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return <div className="flex items-center gap-1" aria-label="Global alerts">
    {renderBell("emergency", emergencyAlerts, "Emergency", "text-red-600", "bg-red-600")}
    {renderBell("critical", criticalAlerts, "Critical", "text-amber-600", "bg-amber-600")}
  </div>;
}
