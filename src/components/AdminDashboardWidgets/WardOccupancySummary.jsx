import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BedDouble, AlertCircle, Users, Activity } from "lucide-react";

export default function WardOccupancySummary() {
  const [wardData, setWardData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOccupancy() {
      try {
        const [wards, beds] = await Promise.all([
          base44.entities.Ward.list("", 50),
          base44.entities.Bed.list("", 500),
        ]);

        const occupancy = wards.map(ward => {
          const wardBeds = beds.filter(b => b.ward_id === ward.id);
          const occupied = wardBeds.filter(b => b.status === "occupied").length;
          const total = wardBeds.length || ward.total_beds || 0;
          const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
          return {
            id: ward.id,
            name: ward.name,
            occupied,
            total,
            percentage,
            type: ward.type,
          };
        });

        setWardData(occupancy.filter(w => w.total > 0));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchOccupancy();
  }, []);

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>;

  const totalBeds = wardData.reduce((sum, w) => sum + w.total, 0);
  const totalOccupied = wardData.reduce((sum, w) => sum + w.occupied, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  return (
    <div className="stat-card bg-gradient-to-br from-white to-chart-4/5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-chart-4/10">
              <BedDouble className="w-5 h-5 text-chart-4" />
            </div>
            Ward Occupancy
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Hospital-wide capacity</p>
        </div>
        <Activity className="w-5 h-5 text-muted-foreground/40" />
      </div>
      <div className="text-3xl font-bold text-chart-4 mb-1">
        {occupancyRate}%
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {totalOccupied} occupied of {totalBeds} total beds
      </p>
      <div className="space-y-3">
        {wardData.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No ward data available</p>
        ) : (
          wardData.map(ward => (
            <div key={ward.id} className="p-3 bg-muted/30 rounded-lg border border-border/40 hover:border-border/80 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground capitalize">{ward.name}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3" /> {ward.occupied} / {ward.total} beds
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${
                    ward.percentage >= 80 ? 'text-destructive' : ward.percentage >= 60 ? 'text-chart-2' : 'text-chart-3'
                  }`}>{ward.percentage}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all shadow-sm ${
                      ward.percentage >= 80 ? 'bg-destructive' : ward.percentage >= 60 ? 'bg-chart-2' : 'bg-chart-3'
                    }`}
                    style={{ width: `${ward.percentage}%` }}
                  />
                </div>
                {ward.percentage >= 80 && <AlertCircle className="w-4 h-4 text-destructive animate-pulse flex-shrink-0" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}