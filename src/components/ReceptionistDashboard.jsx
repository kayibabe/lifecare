import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Calendar, Clock, CheckCircle2 } from "lucide-react";

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState({ todayCheckins: 0, appointments: 0, waiting: 0, completed: 0 });
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [visits, appointments] = await Promise.all([
          base44.entities.Visit.filter({
            visit_date: { $gte: today }
          }, "-created_date", 100),
          base44.entities.Appointment.filter({
            appointment_date: today
          }, "-appointment_date", 50),
        ]);

        const waiting = visits.filter(v => v.queue_status === "waiting");
        const completed = visits.filter(v => v.queue_status === "completed");

        setStats({
          todayCheckins: visits.length,
          appointments: appointments.length,
          waiting: waiting.length,
          completed: completed.length,
        });
        setQueue(waiting.slice(0, 10));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Reception Dashboard</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Check-ins Today</p>
                <p className="text-2xl font-bold">{stats.todayCheckins}</p>
              </div>
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Appointments</p>
                <p className="text-2xl font-bold">{stats.appointments}</p>
              </div>
              <Calendar className="w-5 h-5 text-chart-1" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold text-chart-2">{stats.waiting}</p>
              </div>
              <Clock className="w-5 h-5 text-chart-2" />
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
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">Current Queue</h3>
        {queue.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Queue is clear</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queue.map((v, idx) => (
              <div key={v.id} className={`p-3 rounded border-l-4 ${
                v.priority === "emergency" ? "border-l-destructive bg-destructive/5" :
                v.priority === "urgent" ? "border-l-chart-2 bg-chart-2/5" :
                "border-l-chart-3 bg-chart-3/5"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center">{idx + 1}</span>
                      <p className="text-xs font-semibold truncate">{v.patient_id?.slice(0, 8)}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{v.visit_type} • {v.payment_type}</p>
                  </div>
                  <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0 capitalize">
                    {v.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}