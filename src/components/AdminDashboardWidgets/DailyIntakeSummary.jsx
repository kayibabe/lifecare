import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { UserPlus, Siren, Footprints, BedDouble } from "lucide-react";

export default function DailyIntakeSummary() {
  const [stats, setStats] = useState({ total: 0, emergency: 0, outpatient: 0, inpatient: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIntake() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const visits = await base44.entities.Visit.list("", 1000);
        const todayVisits = visits.filter(v => v.created_date?.substring(0, 10) === today);
        
        const stats = {
          total: todayVisits.length,
          emergency: todayVisits.filter(v => v.visit_type === "emergency").length,
          outpatient: todayVisits.filter(v => v.visit_type === "outpatient").length,
          inpatient: todayVisits.filter(v => v.visit_type === "inpatient").length,
        };
        setStats(stats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchIntake();
  }, []);

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="stat-card bg-gradient-to-br from-white to-primary/5 border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="clinical-label">Total Intake</p>
            <p className="clinical-value text-primary text-4xl">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-2">patients today</p>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>
      <div className={`stat-card bg-gradient-to-br from-white ${stats.emergency > 0 ? 'to-destructive/5 border-destructive/20' : 'to-muted/5'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="clinical-label">Emergency</p>
            <p className={`clinical-value text-4xl ${stats.emergency > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{stats.emergency}</p>
            <p className="text-xs text-muted-foreground mt-2">critical cases</p>
          </div>
          <div className={`p-2.5 rounded-lg ${stats.emergency > 0 ? 'bg-destructive/10 animate-pulse' : 'bg-muted/10'}`}>
            <Siren className={`w-6 h-6 ${stats.emergency > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </div>
      <div className="stat-card bg-gradient-to-br from-white to-chart-2/5 border-chart-2/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="clinical-label">Outpatient</p>
            <p className="clinical-value text-chart-2 text-4xl">{stats.outpatient}</p>
            <p className="text-xs text-muted-foreground mt-2">walk-in cases</p>
          </div>
          <div className="p-2.5 rounded-lg bg-chart-2/10">
            <Footprints className="w-6 h-6 text-chart-2" />
          </div>
        </div>
      </div>
      <div className="stat-card bg-gradient-to-br from-white to-chart-4/5 border-chart-4/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="clinical-label">Inpatient</p>
            <p className="clinical-value text-chart-4 text-4xl">{stats.inpatient}</p>
            <p className="text-xs text-muted-foreground mt-2">admitted</p>
          </div>
          <div className="p-2.5 rounded-lg bg-chart-4/10">
            <BedDouble className="w-6 h-6 text-chart-4" />
          </div>
        </div>
      </div>
    </div>
  );
}