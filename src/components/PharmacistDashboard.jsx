import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Pill, AlertTriangle, Package, Clock } from "lucide-react";

export default function PharmacistDashboard() {
  const [stats, setStats] = useState({ lowStock: 0, pendingRequisitions: 0, dispensings: 0, expiringDrugs: 0 });
  const [lowStockDrugs, setLowStockDrugs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [drugs, requisitions, dispensings] = await Promise.all([
          base44.entities.Drug.list("", 500),
          base44.entities.PharmacyRequisition.filter({ status: "draft" }, "-created_date", 50),
          base44.entities.PharmacyDispensing.filter({
            dispensing_date: new Date().toISOString().slice(0, 10),
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
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-destructive">{stats.lowStock}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Reqs</p>
                <p className="text-2xl font-bold">{stats.pendingRequisitions}</p>
              </div>
              <Package className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today's Dispensings</p>
                <p className="text-2xl font-bold text-chart-2">{stats.dispensings}</p>
              </div>
              <Pill className="w-5 h-5 text-chart-2" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-chart-2">{stats.expiringDrugs}</p>
              </div>
              <Clock className="w-5 h-5 text-chart-2" />
            </div>
          </div>
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