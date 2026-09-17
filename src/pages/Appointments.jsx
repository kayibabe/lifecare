import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import { Calendar as CalendarIcon, Plus, Check, X, Square, CheckSquare, Pencil } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/ui/PageHeader";
import { getLocalDateKey } from "@/lib/dashboardMetrics";

export default function Appointments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMetric = searchParams.get("metric") || "all";
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patient_id: "", appointment_date: "", appointment_time: "", type: "new",
    priority: "normal", doctor_id: "", department: "", notes: "",
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editingAppt, setEditingAppt] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const visibleAppointments = useMemo(() => {
    if (requestedMetric === "appointments") return appointments.filter(a => a.appointment_date === getLocalDateKey());
    if (requestedMetric === "completed") return appointments.filter(a => a.status === "completed");
    if (requestedMetric === "no_show") return appointments.filter(a => a.status === "no_show");
    if (requestedMetric === "scheduled") return appointments.filter(a => a.status === "scheduled");
    return appointments;
  }, [appointments, requestedMetric]);

  useEffect(() => {
    async function load() {
      try {
        const [a, p] = await Promise.all([
          apiClient.entities.Appointment.list("-appointment_date", 100),
          apiClient.entities.Patient.list("-created_date", 200),
        ]);
        setAppointments(a);
        setPatients(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const openEdit = (a) => {
    setEditingAppt(a);
    setForm({ patient_id: a.patient_id, appointment_date: a.appointment_date, appointment_time: a.appointment_time, type: a.type || "new", priority: a.priority || "normal", doctor_id: a.doctor_id || "", department: a.department || "", notes: a.notes || "" });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingAppt) {
        await apiClient.entities.Appointment.update(editingAppt.id, form);
      } else {
        await apiClient.entities.Appointment.create(form);
      }
      const a = await apiClient.entities.Appointment.list("-appointment_date", 100);
      setAppointments(a);
      setShowForm(false);
      setEditingAppt(null);
      setForm({ patient_id: "", appointment_date: "", appointment_time: "", type: "new", priority: "normal", doctor_id: "", department: "", notes: "" });
    } catch (err) {
      toast({ title: "Failed to save appointment", description: err.response?.data?.detail || err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, status) => {
    await apiClient.entities.Appointment.update(id, { status });
    setAppointments(appointments.map(a => a.id === id ? { ...a, status } : a));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    const scheduled = appointments.filter(a => a.status === "scheduled");
    if (selectedIds.length === scheduled.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(scheduled.map(a => a.id));
    }
  };

  const bulkUpdateStatus = async (status) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    for (const id of selectedIds) {
      await apiClient.entities.Appointment.update(id, { status });
    }
    setAppointments(appointments.map(a => selectedIds.includes(a.id) ? { ...a, status } : a));
    setSelectedIds([]);
    setBulkBusy(false);
  };

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const statusColors = {
    scheduled: "bg-chart-1/10 text-chart-1",
    checked_in: "bg-chart-2/10 text-chart-2",
    in_progress: "bg-chart-4/10 text-chart-4",
    completed: "bg-chart-3/10 text-chart-3",
    cancelled: "bg-destructive/10 text-destructive",
    no_show: "bg-muted text-muted-foreground",
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="page-container">
      <PageHeader title="Appointments" subtitle="Schedule and manage patient appointments" icon={CalendarIcon} className="mb-6">
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Appointment
        </button>
      </PageHeader>

      {requestedMetric !== "all" && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          Showing <strong>{requestedMetric === "appointments" ? "today's appointments" : requestedMetric.replace(/_/g, " ")}</strong> from the appointment records.
          <button type="button" onClick={() => navigate("/appointments")} className="ml-3 underline hover:no-underline">Show all</button>
        </div>
      )}

      {showForm && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-sm mb-6">
          <h3 className="font-heading text-lg font-semibold mb-4">{editingAppt ? "Edit Appointment" : "Schedule Appointment"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})}>
                  <option value="">Select patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.mrn})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                <input type="date" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.appointment_date} onChange={e => setForm({...form, appointment_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Time *</label>
                <input type="time" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.appointment_time} onChange={e => setForm({...form, appointment_time: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Type *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="new">New</option><option value="follow_up">Follow-up</option><option value="anc">ANC</option><option value="postnatal">Postnatal</option><option value="procedure">Procedure</option><option value="surgery">Surgery</option><option value="emergency">Emergency</option><option value="review">Review</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="e.g. General, Maternity" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{submitting ? "Saving…" : editingAppt ? "Save Changes" : "Schedule"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingAppt(null); setForm({ patient_id: "", appointment_date: "", appointment_time: "", type: "new", priority: "normal", doctor_id: "", department: "", notes: "" }); }} className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl mx-6 mt-4 p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-primary">{selectedIds.length} selected</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkUpdateStatus("checked_in")} disabled={bulkBusy} className="px-3 py-1.5 bg-chart-2 text-white rounded text-xs font-medium hover:bg-chart-2/90 disabled:opacity-50 flex items-center gap-1"><Check className="w-3 h-3" /> Bulk Check-in</button>
            <button onClick={() => bulkUpdateStatus("cancelled")} disabled={bulkBusy} className="px-3 py-1.5 bg-destructive text-white rounded text-xs font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1"><X className="w-3 h-3" /> Bulk Cancel</button>
            <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 border border-border rounded text-xs font-medium hover:bg-muted">Clear</button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10">
                  <button onClick={toggleSelectAll} className="p-0.5 rounded hover:bg-muted">
                    {selectedIds.length > 0 && selectedIds.length === appointments.filter(a => a.status === "scheduled").length ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Patient</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Priority</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAppointments.map(a => (
                <tr key={a.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    {a.status === "scheduled" && (
                      <button onClick={() => toggleSelect(a.id)} className="p-0.5 rounded hover:bg-muted">
                        {selectedIds.includes(a.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4">{a.appointment_date}</td>
                  <td className="py-3 px-4">{a.appointment_time}</td>
                  <td className="py-3 px-4 font-medium">{getPatientName(a.patient_id)}</td>
                  <td className="py-3 px-4 capitalize">{a.type?.replace(/_/g, " ")}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.priority === "emergency" ? "bg-destructive/10 text-destructive" : a.priority === "urgent" ? "bg-chart-4/10 text-chart-4" : "bg-muted text-muted-foreground"}`}>{a.priority}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || ""}`}>{a.status?.replace(/_/g, " ")}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {(a.status === "scheduled" || a.status === "checked_in") && (
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Edit"><Pencil className="w-4 h-4" /></button>
                      )}
                      {a.status === "scheduled" && (
                        <>
                          <button onClick={() => updateStatus(a.id, "checked_in")} className="p-1.5 rounded hover:bg-chart-2/10 text-chart-2" title="Check in"><Check className="w-4 h-4" /></button>
                          <button onClick={() => updateStatus(a.id, "cancelled")} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Cancel"><X className="w-4 h-4" /></button>
                        </>
                      )}
                      {a.status === "checked_in" && (
                        <button onClick={() => updateStatus(a.id, "completed")} className="p-1.5 rounded hover:bg-chart-3/10 text-chart-3" title="Complete"><Check className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleAppointments.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No appointments scheduled.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
