import React from "react";
import { Heart, Pill, FileText, PenTool } from "lucide-react";

/**
 * Quick-action shortcut buttons inside the patient record view.
 * Lets doctors jump straight to a common task tab without leaving the page.
 */
const ACTIONS = [
  { tab: "vitals", label: "Record Vitals", icon: Heart, color: "text-destructive bg-destructive/10 hover:bg-destructive/20" },
  { tab: "prescriptions", label: "New Prescription", icon: Pill, color: "text-chart-2 bg-chart-2/10 hover:bg-chart-2/20" },
  { tab: "consultation", label: "Consultation Note", icon: FileText, color: "text-primary bg-primary/10 hover:bg-primary/20" },
  { tab: "signatures", label: "Sign Documents", icon: PenTool, color: "text-chart-4 bg-chart-4/10 hover:bg-chart-4/20" },
];

export default function ClinicalQuickActions({ onTabChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {ACTIONS.map(({ tab, label, icon: Icon, color }) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${color}`}
        >
          <Icon className="w-3.5 h-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}