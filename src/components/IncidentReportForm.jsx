import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Save } from "lucide-react";

export default function IncidentReportForm({ patientId, visitId, onComplete, onCancel }) {
  const [form, setForm] = useState({
    incident_type: "near_miss",
    incident_date: new Date().toISOString().slice(0, 16),
    location: "",
    description: "",
    immediate_action: "",
    severity: "moderate",
    root_cause_analysis: "",
    corrective_actions: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.severity) {
      alert("Please fill required fields");
      return;
    }

    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.IncidentReport.create({
        ...form,
        patient_id: patientId,
        visit_id: visitId,
        incident_date: new Date(form.incident_date).toISOString(),
        reported_by_id: user.id,
        reported_by_name: user.full_name,
        status: "open",
      });
      onComplete?.();
    } catch (e) {
      alert("Failed to save report: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> Incident Report
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Incident Type *</label>
              <select
                value={form.incident_type}
                onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="adverse_event">Adverse Event</option>
                <option value="near_miss">Near Miss</option>
                <option value="infection_control">Infection Control</option>
                <option value="medication_error">Medication Error</option>
                <option value="equipment_failure">Equipment Failure</option>
                <option value="patient_fall">Patient Fall</option>
                <option value="pressure_ulcer">Pressure Ulcer</option>
                <option value="communication_breakdown">Communication Breakdown</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Severity *</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date/Time *</label>
              <input
                type="datetime-local"
                value={form.incident_date}
                onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ward, Theatre, etc."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="What happened?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Immediate Action Taken</label>
            <textarea
              value={form.immediate_action}
              onChange={(e) => setForm({ ...form, immediate_action: e.target.value })}
              rows={2}
              placeholder="What was done immediately to address the incident?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Root Cause Analysis</label>
            <textarea
              value={form.root_cause_analysis}
              onChange={(e) => setForm({ ...form, root_cause_analysis: e.target.value })}
              rows={2}
              placeholder="Why did this happen?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Corrective Actions</label>
            <textarea
              value={form.corrective_actions}
              onChange={(e) => setForm({ ...form, corrective_actions: e.target.value })}
              rows={2}
              placeholder="What will be done to prevent recurrence?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Submit Report
            </button>
            <button type="button" onClick={onCancel} className="px-4 py-2.5 border border-border rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}