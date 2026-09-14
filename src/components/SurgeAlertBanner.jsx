import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSurgeStatus } from "@/lib/useSurgeStatus";
import { AlertTriangle, Siren, X, ChevronRight } from "lucide-react";

const STYLES = {
  high: "bg-triage-urgent/10 border-triage-urgent/30 text-triage-urgent",
  critical: "bg-destructive/10 border-destructive/40 text-destructive",
};

/**
 * Global surge alert banner — shown across all pages when surge is high/critical.
 * Dismissible per session; auto-reappears if surge escalates.
 */
export default function SurgeAlertBanner() {
  const { status } = useSurgeStatus();
  const navigate = useNavigate();
  const [dismissedLevel, setDismissedLevel] = useState(null);

  if (!status || status.overall === "normal") return null;
  if (dismissedLevel === status.overall) return null;

  const triggered = status.metrics.filter(m => m.level !== "normal");
  const Icon = status.overall === "critical" ? Siren : AlertTriangle;

  return (
    <div className={`flex items-center gap-3 px-4 lg:px-8 py-2.5 border-b ${STYLES[status.overall]}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${status.overall === "critical" ? "animate-pulse" : ""}`} />
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="text-xs font-bold uppercase tracking-wide">
          {status.overall === "critical" ? "Critical Surge" : "Surge Alert"}
        </span>
        <span className="text-xs font-medium truncate">
          {triggered.map(m => `${m.label}: ${m.display}`).join("  •  ")}
        </span>
      </div>
      <button
        onClick={() => navigate("/surge")}
        className="text-xs font-semibold inline-flex items-center gap-0.5 hover:underline flex-shrink-0"
      >
        View <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setDismissedLevel(status.overall)}
        className="p-1 rounded hover:bg-current/10 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}