import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRightLeft, Plus, X, Save, Loader2, Clock, AlertTriangle, CheckCircle } from "lucide-react";

export default function ShiftHandoffNotes() {
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    from_doctor_id: "",
    to_doctor_id: "",
    shift_type: "morning",
    critical_cases: "",
    pending_investigations: "",
    pending_consults: "",
    treatment_updates: "",
    discharge_planning: "",
    new_admissions: "",
    incidents: "",
    general_notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [handoverData, userData] = await Promise.all([
        base44.entities.DoctorHandover.filter(
          { created_date: { $gte: new Date(Date.now() - 7 * 86400000).toISOString() } },
          "-created_date",
          50
        ),
        base44.entities.User.list("", 100),
      ]);
      setHandovers(handoverData);
      setUsers(userData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.from_doctor_id || !form.shift_type) {
      alert("Please fill required fields");
      return;
    }

    setSaving(true);
    try {
      const fromDoc = users.find(u => u.id === form.from_doctor_id);
      const toDoc = form.to_doctor_id ? users.find(u => u.id === form.to_doctor_id) : null;

      if (editingId) {
        await base44.entities.DoctorHandover.update(editingId, {
          ...form,
          to_doctor_id: form.to_doctor_id || null,
          handover_date: new Date().toISOString(),
        });
      } else {
        await base44.entities.DoctorHandover.create({
          ...form,
          to_doctor_id: form.to_doctor_id || null,
          handover_date: new Date().toISOString(),
          status: "pending",
          acknowledged: false,
        });
      }
      loadData();
      setShowForm(false);
      setEditingId(null);
      setForm({
        from_doctor_id: "",
        to_doctor_id: "",
        shift_type: "morning",
        critical_cases: "",
        pending_investigations: "",
        pending_consults: "",
        treatment_updates: "",
        discharge_planning: "",
        new_admissions: "",
        incidents: "",
        general_notes: "",
      });
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (handover) => {
    setEditingId(handover.id);
    setForm(handover);
    setShowForm(true);
  };

  const getDocName = (id) => {
    const doc = users.find(u => u.id === id);
    return doc ? doc.full_name : id?.slice(0, 8) || "Unknown";
  };

  const shiftLabel = {
    morning: "Morning (6am–2pm)",
    afternoon: "Afternoon (2pm–10pm)",
    night: "Night (10pm–6am)",
    weekend: "Weekend",
    on_call: "On-Call",
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm flex justify-center">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-primary" /> Shift Handoff Notes
        </h3>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm({
              from_doctor_id: "",
              to_doctor_id: "",
              shift_type: "morning",
              critical_cases: "",
              pending_investigations: "",
              pending_consults: "",
              treatment_updates: "",
              discharge_planning: "",
              new_admissions: "",
              incidents: "",
              general_notes: "",
            });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" /> New Handoff
        </button>
      </div>

      {handovers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No handoff notes yet.</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {handovers.map(h => (
            <div key={h.id} className="border border-border/40 rounded-lg p-3 hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    {getDocName(h.from_doctor_id)}
                    <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                    {h.to_doctor_id ? getDocName(h.to_doctor_id) : "Next shift"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {shiftLabel[h.shift_type]} • {new Date(h.handover_date).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      h.acknowledged
                        ? "bg-chart-3/10 text-chart-3"
                        : "bg-chart-4/10 text-chart-4"
                    }`}
                  >
                    {h.acknowledged ? (
                      <>
                        <CheckCircle className="w-2.5 h-2.5" /> Acknowledged
                      </>
                    ) : (
                      <>
                        <Clock className="w-2.5 h-2.5" /> Pending
                      </>
                    )}
                  </span>
                  <button
                    onClick={() => handleEdit(h)}
                    className="p-1 rounded hover:bg-muted text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Compact notes preview */}
              <div className="text-xs space-y-1">
                {h.critical_cases && (
                  <div className="p-1.5 bg-destructive/5 rounded text-destructive flex gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span><strong>Critical:</strong> {h.critical_cases}</span>
                  </div>
                )}
                {h.pending_investigations && (
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Pending Labs:</strong> {h.pending_investigations}
                  </p>
                )}
                {h.general_notes && (
                  <p className="text-muted-foreground italic">{h.general_notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" /> {editingId ? "Edit" : "Create"} Shift Handoff
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Handing Over Doctor *</label>
                  <select
                    required
                    value={form.from_doctor_id}
                    onChange={e => setForm({ ...form, from_doctor_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select doctor</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Receiving Doctor</label>
                  <select
                    value={form.to_doctor_id}
                    onChange={e => setForm({ ...form, to_doctor_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">To be assigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Shift Type *</label>
                  <select
                    required
                    value={form.shift_type}
                    onChange={e => setForm({ ...form, shift_type: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="morning">Morning (6am–2pm)</option>
                    <option value="afternoon">Afternoon (2pm–10pm)</option>
                    <option value="night">Night (10pm–6am)</option>
                    <option value="weekend">Weekend</option>
                    <option value="on_call">On-Call</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Critical Cases</label>
                  <textarea
                    value={form.critical_cases}
                    onChange={e => setForm({ ...form, critical_cases: e.target.value })}
                    placeholder="e.g. ICU patient, post-op complications..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-16 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Pending Investigations</label>
                  <textarea
                    value={form.pending_investigations}
                    onChange={e => setForm({ ...form, pending_investigations: e.target.value })}
                    placeholder="Awaiting lab/imaging results..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-16 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Pending Consults</label>
                  <textarea
                    value={form.pending_consults}
                    onChange={e => setForm({ ...form, pending_consults: e.target.value })}
                    placeholder="Awaiting specialist review..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-12 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Treatment Updates</label>
                  <textarea
                    value={form.treatment_updates}
                    onChange={e => setForm({ ...form, treatment_updates: e.target.value })}
                    placeholder="Changes to treatment plan..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-12 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Discharge Planning</label>
                  <textarea
                    value={form.discharge_planning}
                    onChange={e => setForm({ ...form, discharge_planning: e.target.value })}
                    placeholder="Ready for discharge..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-12 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">New Admissions</label>
                  <textarea
                    value={form.new_admissions}
                    onChange={e => setForm({ ...form, new_admissions: e.target.value })}
                    placeholder="Patients admitted during shift..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-12 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Incidents</label>
                  <textarea
                    value={form.incidents}
                    onChange={e => setForm({ ...form, incidents: e.target.value })}
                    placeholder="Adverse events or issues..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-12 resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">General Notes</label>
                <textarea
                  value={form.general_notes}
                  onChange={e => setForm({ ...form, general_notes: e.target.value })}
                  placeholder="Any other important information..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-16 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Handoff"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}