import { useEffect, useState } from "react";
import { apiClient } from "@/api/apiClient";
import { formatApiError } from "@/api/customClient";

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">Clinical Care</p>
        <h1 className="text-2xl font-bold text-slate-900">Dental Clinic</h1>
        <p className="text-sm text-slate-500 mt-1">Record dental encounters, tooth findings, diagnoses, and treatment plans.</p>
      </div>
      {message && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>}

      <section className="grid lg:grid-cols-[320px_1fr] gap-6">
        <div className="bg-white border rounded-xl p-4 space-y-4">
          <h2 className="font-semibold">New dental encounter</h2>
          <form onSubmit={create} className="space-y-3">
            <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select patient</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.name} · {p.mrn}</option>)}
            </select>
            {Object.entries({ chief_complaint: "Chief complaint", dental_history: "Dental history", examination_notes: "Examination notes", diagnosis: "Diagnosis" }).map(([key, label]) => (
              <textarea key={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={label} className="w-full border rounded-lg px-3 py-2 text-sm min-h-16" />
            ))}
            <button className="w-full rounded-lg bg-emerald-700 text-white py-2 text-sm font-medium">Save encounter</button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold mb-3">Dental queue</h2>
            <div className="divide-y">
              {encounters.length === 0 && <p className="text-sm text-slate-500">No dental encounters yet.</p>}
              {encounters.map((e) => <button key={e.id} onClick={() => load(e.id)} className={`w-full text-left py-3 ${selected?.id === e.id ? "bg-emerald-50" : ""}`}><span className="font-medium">{patients.find((p) => p.id === e.patient_id)?.full_name || e.patient_id}</span><span className="text-xs text-slate-500 ml-3">{e.status} · {new Date(e.created_at).toLocaleString()}</span><span className="block text-sm text-slate-600">{e.chief_complaint || "No complaint recorded"}</span></button>)}
            </div>
          </div>

          {selected && <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h2 className="font-semibold">Tooth findings</h2>
              <form onSubmit={addFinding} className="grid grid-cols-2 gap-2">
                <input required placeholder="Tooth number" value={finding.tooth_number} onChange={(e) => setFinding({ ...finding, tooth_number: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                <input placeholder="Surface" value={finding.surface} onChange={(e) => setFinding({ ...finding, surface: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                <input required placeholder="Finding" value={finding.finding} onChange={(e) => setFinding({ ...finding, finding: e.target.value })} className="border rounded-lg px-2 py-2 text-sm col-span-2" />
                <input placeholder="Severity" value={finding.severity} onChange={(e) => setFinding({ ...finding, severity: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                <button className="rounded-lg bg-slate-800 text-white text-sm">Add finding</button>
              </form>
              <div className="space-y-2">{selected.tooth_findings?.map((f) => <div key={f.id} className="text-sm border-t pt-2"><strong>Tooth {f.tooth_number}</strong> · {f.finding} {f.surface && `(${f.surface})`}</div>)}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h2 className="font-semibold">Treatment plan</h2>
              {selected.treatment_plan ? <div className="text-sm"><p>Status: <strong>{selected.treatment_plan.status}</strong></p><p>Estimated total: {selected.treatment_plan.estimated_total}</p>{selected.treatment_plan.items?.map((i) => <p key={i.id} className="border-t mt-2 pt-2">{i.procedure_code} · {i.procedure_name} · {i.fee}</p>)}</div> : <form onSubmit={addPlan} className="space-y-2"><input required placeholder="Procedure code" value={item.procedure_code} onChange={(e) => setItem({ ...item, procedure_code: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm" /><input required placeholder="Procedure name" value={item.procedure_name} onChange={(e) => setItem({ ...item, procedure_name: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm" /><div className="flex gap-2"><input placeholder="Tooth" value={item.tooth_number} onChange={(e) => setItem({ ...item, tooth_number: e.target.value })} className="w-1/2 border rounded-lg px-2 py-2 text-sm" /><input type="number" min="0" step="0.01" placeholder="Fee" value={item.fee} onChange={(e) => setItem({ ...item, fee: e.target.value })} className="w-1/2 border rounded-lg px-2 py-2 text-sm" /></div><textarea placeholder="Plan notes" value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm" /><button className="w-full rounded-lg bg-slate-800 text-white py-2 text-sm">Create treatment plan</button></form>}
            </div>
          </div>}
        </div>
      </section>
    </div>
  );
}
