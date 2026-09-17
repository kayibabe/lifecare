import { useState, useEffect } from "react";
import { apiClient } from "@/api/apiClient";
import { FlaskConical, AlertTriangle, Stethoscope, CheckCircle2 } from "lucide-react";
import MetricCard from "@/components/ui/MetricCard";
import { getLocalDateKey, getDateWindowIso, isPendingLabOrder, METRIC_LIMITS } from "@/lib/dashboardMetrics";

export default function DoctorDashboard() {
  const [stats, setStats] = useState({ todayConsultations: 0, pendingLabs: 0, prescriptions: 0, alerts: 0 });
  const [recentConsultations, setRecentConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const user = await apiClient.auth.me();
        const [consultations, labs, prescriptions] = await Promise.all([
          apiClient.entities.Consultation.filter(
            { doctor_id: user.id, status: { $in: ["in_progress", "completed"] } },
            "-created_date",
            50
          ),
          apiClient.entities.LabOrder.filter({ created_date: { $gte: getDateWindowIso(30) } }, "-created_date", METRIC_LIMITS.operational),
          apiClient.entities.Prescription.filter({ status: { $in: ["draft", "pending"] } }, "-created_date", 30),
        ]);
        
        const today = getLocalDateKey();
        const todayConsults = consultations.filter(c => c.consultation_date?.startsWith(today));
        
        setStats({
          todayConsultations: todayConsults.length,
          pendingLabs: labs.filter(isPendingLabOrder).length,
          prescriptions: prescriptions.length,
          alerts: labs.filter(l => l.priority === "urgent" || l.priority === "stat").length,
        });
        setRecentConsultations(todayConsults.slice(0, 5));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Clinical Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Consultations" value={stats.todayConsultations} icon={Stethoscope} to="/clinical" />
          <MetricCard label="Pending Labs" value={stats.pendingLabs} icon={FlaskConical} iconColor="text-chart-1" to="/lab" />
          <MetricCard label="Prescriptions" value={stats.prescriptions} icon={CheckCircle2} iconColor="text-chart-3" to="/pharmacy" />
          <MetricCard label="Urgent Labs" value={stats.alerts} icon={AlertTriangle} iconColor="text-destructive" valueColor="text-destructive" to="/lab" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Today's Consultations</h3>
        {recentConsultations.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No consultations scheduled</p>
        ) : (
          <div className="space-y-2">
            {recentConsultations.map(c => (
              <div key={c.id} className="flex items-start justify-between p-2.5 bg-muted/20 rounded border border-border/40">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{c.patient_id?.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground">{c.chief_complaint}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ml-2 ${
                  c.status === "completed" ? "bg-chart-3/10 text-chart-3" : "bg-primary/10 text-primary"
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
