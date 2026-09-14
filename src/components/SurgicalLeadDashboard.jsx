import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, Calendar, CheckCircle2, Clock, AlertTriangle, Users } from "lucide-react";

export default function SurgicalLeadDashboard() {
  const [stats, setStats] = useState({ scheduled: 0, completed: 0, pending: 0, urgent: 0, staffAvailable: 0, theaterUtil: 0 });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [surgeries, staff] = await Promise.all([
          base44.entities.SurgicalBooking.filter({ scheduled_date: { $gte: today } }, "-scheduled_date", 100),
          base44.entities.DoctorSchedule.filter({ shift_date: today }, "", 50),
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
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
              </div>
              <Calendar className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-chart-3">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-chart-3" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-chart-2">{stats.pending}</p>
              </div>
              <Clock className="w-5 h-5 text-chart-2" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold text-destructive">{stats.urgent}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Surgeons</p>
                <p className="text-2xl font-bold">{stats.staffAvailable}</p>
              </div>
              <Users className="w-5 h-5 text-chart-4" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Theater Util</p>
                <p className="text-2xl font-bold">{stats.theaterUtil}%</p>
              </div>
              <Activity className="w-5 h-5 text-chart-1" />
            </div>
          </div>
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