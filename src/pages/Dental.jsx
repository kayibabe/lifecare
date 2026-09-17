import { useEffect, useState } from "react";
import { apiClient } from "@/api/apiClient";
import { formatApiError } from "@/api/customClient";
import { Activity, ClipboardList, Smile, Users } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const blankFinding = { tooth_number: "", surface: "", finding: "", severity: "", notes: "" };
const blankItem = { procedure_code: "", procedure_name: "", tooth_number: "", fee: "", notes: "" };

export default function Dental() {
  const [patients, setPatients] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [patientId, setPatientId] = useState("");
  const [form, setForm] = useState({ chief_complaint: "", dental_history: "", examination_notes: "", diagnosis: "" });
  const [finding, setFinding] = useState(blankFinding);
  const [item, setItem] = useState(blankItem);
  const [planNotes, setPlanNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const [patientRows, encounterRows] = await Promise.all([
      apiClient.entities.Patient.list("-created_date", 200),
      apiClient.dental.listEncounters(),
    ]);
    setPatients(patientRows || []);
    setEncounters(encounterRows || []);
  };

  useEffect(() => { refresh().catch((err) => setError(formatApiError(err))); }, []);

  const load = async (id) => {
    setSelected(await apiClient.dental.getEncounter(id));
    setError("");
  };

  const create = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const created = await apiClient.dental.createEncounter({ patient_id: patientId, ...form });
      setMessage("Dental encounter saved.");
      await refresh();
      await load(created.id);
    } catch (err) { setError(formatApiError(err)); }
  };

  const addFinding = async (event) => {
    event.preventDefault();
    try {
      await apiClient.dental.addToothFinding(selected.id, finding);
      setFinding(blankFinding);
      await load(selected.id);
    } catch (err) { setError(formatApiError(err)); }
  };

  const addPlan = async (event) => {
    event.preventDefault();
    try {
      await apiClient.dental.createTreatmentPlan(selected.id, {
        notes: planNotes,
        items: [{ ...item, fee: Number(item.fee || 0) }],
      });
      setItem(blankItem);
      setPlanNotes("");
      await load(selected.id);
    } catch (err) { setError(formatApiError(err)); }
  };

  const openEncounters = encounters.filter((encounter) => encounter.status !== "completed").length;
  const completedEncounters = encounters.length - openEncounters;
  const patientName = (id) => patients.find((patient) => patient.id === id)?.full_name || id;
  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Dental Clinic" subtitle="Dental encounters, tooth findings, diagnoses & treatment plans" icon={Smile} />

      <section className="bg-[#337daf] rounded-lg overflow-hidden">
        <div className="px-5 py-4 text-white">
          <h2 className="font-heading text-xl font-semibold">Dental Dashboard</h2>
          <p className="text-sm text-white/80 mt-1">Track the dental queue and continue patient care from one workspace.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/95 p-4">
          <div className="rounded-lg bg-muted/30 p-4 text-center"><Users className="w-5 h-5 text-primary mx-auto mb-2" /><p className="text-2xl font-semibold">{encounters.length}</p><p className="text-xs text-muted-foreground">Total Encounters</p></div>
          <div className="rounded-lg bg-muted/30 p-4 text-center"><Activity className="w-5 h-5 text-amber-600 mx-auto mb-2" /><p className="text-2xl font-semibold">{openEncounters}</p><p className="text-xs text-muted-foreground">Open Encounters</p></div>
          <div className="rounded-lg bg-muted/30 p-4 text-center"><ClipboardList className="w-5 h-5 text-emerald-600 mx-auto mb-2" /><p className="text-2xl font-semibold">{completedEncounters}</p><p className="text-xs text-muted-foreground">Completed</p></div>
        </div>
      </section>

      {message && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-border lg:col-span-1">
          <div className="p-3 border-b border-border flex items-center justify-between"><h3 className="font-heading text-sm font-semibold">Dental Queue</h3><span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{encounters.length}</span></div>
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {encounters.length === 0 && <p className="p-4 text-sm text-muted-foreground">No dental encounters yet.</p>}
            {encounters.map((encounter) => <button key={encounter.id} onClick={() => load(encounter.id)} className={`w-full text-left p-3 border-l-2 transition-colors ${selected?.id === encounter.id ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-muted/40"}`}><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium truncate">{patientName(encounter.patient_id)}</p><span className="text-[10px] uppercase text-muted-foreground">{encounter.status}</span></div><p className="text-xs text-muted-foreground mt-1">{encounter.chief_complaint || "No complaint recorded"}</p><p className="text-[11px] text-muted-foreground/70 mt-1">{new Date(encounter.created_at).toLocaleString()}</p></button>)}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-border p-5">
            <h3 className="font-heading text-base font-semibold mb-4">New Dental Encounter</h3>
            <form onSubmit={create} className="space-y-3">
              <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass}><option value="">Select patient</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.name} · {p.mrn}</option>)}</select>
              <div className="grid md:grid-cols-2 gap-3">{Object.entries({ chief_complaint: "Chief complaint", dental_history: "Dental history", examination_notes: "Examination notes", diagnosis: "Diagnosis" }).map(([key, label]) => <textarea key={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={label} className={`${inputClass} min-h-20 resize-y`} />)}</div>
              <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90">Save encounter</button>
            </form>
          </div>

          {selected ? <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-border p-5 space-y-4"><div className="flex items-center justify-between"><h3 className="font-heading text-base font-semibold">Tooth Findings</h3><span className="text-xs text-muted-foreground">{selected.tooth_findings?.length || 0} recorded</span></div><form onSubmit={addFinding} className="grid grid-cols-2 gap-2"><input required placeholder="Tooth number" value={finding.tooth_number} onChange={(e) => setFinding({ ...finding, tooth_number: e.target.value })} className={inputClass} /><input placeholder="Surface" value={finding.surface} onChange={(e) => setFinding({ ...finding, surface: e.target.value })} className={inputClass} /><input required placeholder="Finding" value={finding.finding} onChange={(e) => setFinding({ ...finding, finding: e.target.value })} className={`${inputClass} col-span-2`} /><input placeholder="Severity" value={finding.severity} onChange={(e) => setFinding({ ...finding, severity: e.target.value })} className={inputClass} /><button className="rounded-lg bg-slate-800 text-white text-sm">Add finding</button></form><div className="space-y-2">{selected.tooth_findings?.map((f) => <div key={f.id} className="text-sm border-t pt-2"><strong>Tooth {f.tooth_number}</strong> · {f.finding} {f.surface && `(${f.surface})`}</div>)}</div></div>
            <div className="bg-white rounded-lg border border-border p-5 space-y-4"><h3 className="font-heading text-base font-semibold">Treatment Plan</h3>{selected.treatment_plan ? <div className="text-sm space-y-2"><p>Status: <strong>{selected.treatment_plan.status}</strong></p><p>Estimated total: <strong>{selected.treatment_plan.estimated_total}</strong></p>{selected.treatment_plan.items?.map((planItem) => <p key={planItem.id} className="border-t mt-2 pt-2">{planItem.procedure_code} · {planItem.procedure_name} · {planItem.fee}</p>)}</div> : <form onSubmit={addPlan} className="space-y-2"><input required placeholder="Procedure code" value={item.procedure_code} onChange={(e) => setItem({ ...item, procedure_code: e.target.value })} className={inputClass} /><input required placeholder="Procedure name" value={item.procedure_name} onChange={(e) => setItem({ ...item, procedure_name: e.target.value })} className={inputClass} /><div className="flex gap-2"><input placeholder="Tooth" value={item.tooth_number} onChange={(e) => setItem({ ...item, tooth_number: e.target.value })} className={`${inputClass} w-1/2`} /><input type="number" min="0" step="0.01" placeholder="Fee" value={item.fee} onChange={(e) => setItem({ ...item, fee: e.target.value })} className={`${inputClass} w-1/2`} /></div><textarea placeholder="Plan notes" value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} className={`${inputClass} min-h-20`} /><button className="w-full rounded-lg bg-slate-800 text-white py-2.5 text-sm">Create treatment plan</button></form>}</div>
          </div> : <div className="bg-white rounded-lg border border-border p-10 text-center text-muted-foreground"><Smile className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Select a dental encounter to review findings and treatment.</p></div>}
        </div>
      </section>
    </div>
  );
}
