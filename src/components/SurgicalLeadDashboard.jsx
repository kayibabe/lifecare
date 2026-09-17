import { useState, useEffect } from "react";
import { apiClient } from "@/api/apiClient";
import { Activity, Calendar, CheckCircle2, Clock, AlertTriangle, Users } from "lucide-react";
import MetricCard from "@/components/ui/MetricCard";
import { getLocalDateKey } from "@/lib/dashboardMetrics";

export default function SurgicalLeadDashboard() {
  const [stats, setStats] = useState({ scheduled: 0, completed: 0, pending: 0, urgent: 0, staffAvailable: 0, theaterUtil: 0 });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = getLocalDateKey();
        const [surgeries, staff] = await Promise.all([
          apiClient.entities.SurgicalBooking.filter({ scheduled_date: { $gte: today } }, "-scheduled_date", 100),
          apiClient.entities.DoctorSchedule.filter({ shift_date: today }, "", 50),
        ]);

        const scheduled = surgeries.filter(s => s.status === "scheduled" || s.status === "confirmed");
        const completed = surgeries.filter(s => s.status === "completed");
        const pending = surgeries.filter(s => s.status === "scheduled");
        const urgent = surgeries.filter(s => s.priority === "urgent" || s.priority === "emergency");
        const surgeons = new Set(scheduled.map(s => s.surgeon_id).filter(Boolean)).size;
        const theaterUtil = scheduled.length > 0 ? Math.round((completed.length / scheduled.length) * 100) : 0;

        setStats({
          scheduled: scheduled.length,
          completed: completed.length,
          pending: pending.length,
          urgent: urgent.length,
          staffAvailable: surgeons,
          theaterUtil,
        });
        setBookings(surgeries.slice(0, 6));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Surgical Operations</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <MetricCard label="Scheduled" value={stats.scheduled} icon={Calendar} to="/surgery-calendar" />
          <MetricCard label="Completed" value={stats.completed} icon={CheckCircle2} iconColor="text-chart-3" valueColor="text-chart-3" to="/surgery-calendar" />
          <MetricCard label="Pending" value={stats.pending} icon={Clock} iconColor="text-chart-2" valueColor="text-chart-2" to="/surgery-calendar" />
          <MetricCard label="Urgent" value={stats.urgent} icon={AlertTriangle} iconColor="text-destructive" valueColor="text-destructive" to="/surgery-calendar" />
          <MetricCard label="Surgeons" value={stats.staffAvailable} icon={Users} iconColor="text-chart-4" to="/surgery-calendar" />
          <MetricCard label="Theater Util" value={`${stats.theaterUtil}%`} icon={Activity} iconColor="text-chart-1" to="/surgery-calendar" />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Today's Surgical Schedule</h3>
        {bookings.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No surgeries scheduled</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-2">Procedure</th><th className="text-left py-2">Surgeon</th><th className="text-left py-2">Time</th><th className="text-left py-2">Priority</th><th className="text-left py-2">Status</th></tr></thead>
              <tbody>
                {bookings.map(s => (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 font-medium">{s.procedure_name}</td>
                    <td className="py-2 text-muted-foreground text-[11px]">{s.surgeon_name || "—"}</td>
                    <td className="py-2 font-mono text-[10px]">{s.start_time} - {s.end_time || "TBD"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        s.priority === "emergency" ? "bg-destructive/10 text-destructive" :
                        s.priority === "urgent" ? "bg-chart-2/10 text-chart-2" :
                        "bg-muted/60 text-muted-foreground"
                      }`}>{s.priority || "elective"}</span>
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        s.status === "completed" ? "bg-chart-3/10 text-chart-3" :
                        s.status === "in_progress" ? "bg-primary/10 text-primary" :
                        s.status === "confirmed" ? "bg-chart-1/10 text-chart-1" :
                        "bg-muted/60 text-muted-foreground"
                      }`}>{s.status?.replace(/_/g, " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
