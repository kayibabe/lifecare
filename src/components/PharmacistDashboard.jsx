import { useState, useEffect } from "react";
import { apiClient } from "@/api/apiClient";
import { Pill, AlertTriangle, Package, Clock } from "lucide-react";
import MetricCard from "@/components/ui/MetricCard";
import { getLocalDateKey } from "@/lib/dashboardMetrics";

export default function PharmacistDashboard() {
  const [stats, setStats] = useState({ lowStock: 0, pendingRequisitions: 0, dispensings: 0, expiringDrugs: 0 });
  const [lowStockDrugs, setLowStockDrugs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [drugs, requisitions, dispensings] = await Promise.all([
          apiClient.entities.Drug.list("", 500),
          apiClient.entities.PharmacyRequisition.filter({ status: "draft" }, "-created_date", 50),
          apiClient.entities.PharmacyDispensing.filter({
            dispensing_date: getLocalDateKey(),
          }, "", 100),
        ]);

        const low = drugs.filter(d => d.quantity_in_stock <= d.reorder_level);
        const expiring = drugs.filter(d => d.expiry_date && 
          new Date(d.expiry_date) < new Date(Date.now() + 90 * 86400000) &&
          new Date(d.expiry_date) >= new Date()
        );

        setStats({
          lowStock: low.length,
          pendingRequisitions: requisitions.length,
          dispensings: dispensings.length,
          expiringDrugs: expiring.length,
        });
        setLowStockDrugs(low.slice(0, 8));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pharmacy Inventory Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Low Stock" value={stats.lowStock} icon={AlertTriangle} iconColor="text-destructive" valueColor="text-destructive" to="/pharmacy?metric=lowStock" />
          <MetricCard label="Pending Reqs" value={stats.pendingRequisitions} icon={Package} to="/pharmacy?metric=pendingReqs" />
          <MetricCard label="Today's Dispensings" value={stats.dispensings} icon={Pill} iconColor="text-chart-2" valueColor="text-chart-2" to="/pharmacy?metric=dispensed" />
          <MetricCard label="Expiring Soon" value={stats.expiringDrugs} icon={Clock} iconColor="text-chart-2" valueColor="text-chart-2" to="/pharmacy?metric=expiring" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> Low Stock Drugs
        </h3>
        {lowStockDrugs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">All drugs adequately stocked</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {lowStockDrugs.map(drug => (
              <div key={drug.id} className="p-2.5 bg-destructive/5 rounded border border-destructive/20">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{drug.name}</p>
                    <p className="text-[11px] text-muted-foreground">{drug.generic_name}</p>
                  </div>
                  <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold text-destructive bg-destructive/10 flex-shrink-0">
                    {drug.quantity_in_stock}/{drug.reorder_level}
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
