import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

export default function WasteVolumeChart({ logs, categories }) {
  const chartData = useMemo(() => {
    const dailyMap = {};
    const today = new Date();

    // Build last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      dailyMap[key] = { date: label, total: 0, hazardous: 0, general: 0 };
    }

    logs.forEach(log => {
      const logDate = (log.generated_at || log.created_date)?.slice(0, 10);
      if (dailyMap[logDate] != null) {
        const cat = categories.find(c => c.id === log.waste_category_id);
        const isHazardous = cat?.code !== "GEN";
        dailyMap[logDate].total += log.quantity_kg || 0;
        if (isHazardous) {
          dailyMap[logDate].hazardous += log.quantity_kg || 0;
        } else {
          dailyMap[logDate].general += log.quantity_kg || 0;
        }
      }
    });

    return Object.values(dailyMap).map(d => ({
      ...d,
      total: Math.round(d.total * 10) / 10,
      hazardous: Math.round(d.hazardous * 10) / 10,
      general: Math.round(d.general * 10) / 10,
    }));
  }, [logs, categories]);

  const totalWeek = chartData.reduce((s, d) => s + d.total, 0);

  if (totalWeek === 0 && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
        No volume data yet — log waste to see trends.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-heading text-sm font-semibold flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-chart-1" /> Daily Disposal Volume (7 Days)
        </h4>
        <span className="text-xs text-muted-foreground">
          Total: <strong className="font-mono">{totalWeek.toFixed(1)} kg</strong>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" kg" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value) => [`${value} kg`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="hazardous" name="Hazardous" stackId="a" fill="hsl(var(--destructive))" radius={[0, 0, 0, 0]} />
          <Bar dataKey="general" name="General" stackId="a" fill="hsl(var(--muted-foreground) / 0.4)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}