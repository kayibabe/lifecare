import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, Users, AlertTriangle, ClipboardList, Heart } from "lucide-react";

export default function NurseDashboard() {
  const [stats, setStats] = useState({ admissions: 0, tasks: 0, criticalVitals: 0, discharges: 0 });
  const [nurseTasks, setNurseTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [admissions, tasks, vitals, discharges] = await Promise.all([
          base44.entities.Admission.filter({ status: "admitted" }, "", 100),
          base44.entities.NurseTask.filter({ status: { $in: ["pending", "in_progress"] } }, "-created_date", 20),
          base44.entities.VitalSigns.filter({ recorded_date: new Date().toISOString().slice(0, 10) }, "-recorded_date", 100),
          base44.entities.Discharge.filter({ discharge_date: new Date().toISOString().slice(0, 10) }, "", 50),
        ]);
        
        const critical = vitals.filter(v => 
          (v.bp_systolic > 180 || v.bp_systolic < 90) || 
          (v.heart_rate > 120 || v.heart_rate < 60) ||
          v.spo2 < 92 ||
          v.temperature > 38.5
        );

        setStats({
          admissions: admissions.length,
          tasks: tasks.length,
          criticalVitals: critical.length,
          discharges: discharges.length,
        });
        setNurseTasks(tasks.slice(0, 8));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Nursing Station Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Admitted</p>
                <p className="text-2xl font-bold">{stats.admissions}</p>
              </div>
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold">{stats.tasks}</p>
              </div>
              <ClipboardList className="w-5 h-5 text-chart-2" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Critical Vitals</p>
                <p className="text-2xl font-bold text-destructive">{stats.criticalVitals}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Discharges Today</p>
                <p className="text-2xl font-bold text-chart-3">{stats.discharges}</p>
              </div>
              <Activity className="w-5 h-5 text-chart-3" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" /> Pending Care Tasks
        </h3>
        {nurseTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No pending tasks</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {nurseTasks.map(task => (
              <div key={task.id} className={`p-2.5 rounded border-l-4 ${
                task.priority === "high" ? "border-l-destructive bg-destructive/5" :
                task.priority === "medium" ? "border-l-chart-2 bg-chart-2/5" :
                "border-l-chart-3 bg-chart-3/5"
              }`}>
                <p className="text-xs font-semibold">{task.task_type}</p>
                <p className="text-[11px] text-muted-foreground">{task.patient_id?.slice(0, 8)} • {task.assigned_to}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}