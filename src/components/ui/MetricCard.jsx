import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function MetricCard({ label, value, sub, icon: Icon, iconColor = "text-primary", to, valueColor = "text-foreground", className = "" }) {
  const content = (
    <div className={`group relative h-full rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all ${to ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" : ""} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground/70">{sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
          {to && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />}
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to} className="block h-full" aria-label={`Open ${label}`}>{content}</Link> : content;
}

