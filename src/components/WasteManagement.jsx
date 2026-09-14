import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, AlertTriangle, CheckCircle, Clock, Flame, Plus, Save, ArrowRight, Building2, X, PenTool, FileSignature } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import WasteVolumeChart from "@/components/WasteVolumeChart";
import WasteComplianceDashboard from "@/components/WasteComplianceDashboard";

const WHO_COLORS = {
  black: "bg-gray-800 text-white",
  yellow: "bg-yellow-400 text-black",
  red: "bg-red-500 text-white",
  brown: "bg-amber-700 text-white",
  blue: "bg-blue-500 text-white",
};

const STATUS_FLOW = ["generated", "segregated", "collected", "transported", "treated", "disposed"];
const STATUS_LABELS = {
  generated: "Generated",
  segregated: "Segregated",
  collected: "Collected",
  transported: "Transported",
  treated: "Treated",
  disposed: "Disposed",
};

export default function WasteManagement() {
  const [categories, setCategories] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Signature state
  const [signingLog, setSigningLog] = useState(null);
  const [savingSignature, setSavingSignature] = useState(false);

  const [logForm, setLogForm] = useState({
    waste_category_id: "",
    origin_department: "nursing",
    quantity_kg: "",
    container_count: "1",
    disposal_method: "incineration",
    notes: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    code: "",
    description: "",
    color_code: "yellow",
    container_type: "",
    max_storage_hours: "24",
    requires_incineration: false,
  });

  const loadData = useCallback(async () => {
    try {
      const [cats, l] = await Promise.all([
        base44.entities.WasteCategory.list("", 50),
        base44.entities.WasteLog.list("-created_date", 200),
      ]);
      setCategories(cats);
      setLogs(l);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const addCategory = async (e) => {
    e.preventDefault();
    await base44.entities.WasteCategory.create({
      ...categoryForm,
      max_storage_hours: Number(categoryForm.max_storage_hours),
    });
    setShowCategoryForm(false);
    setCategoryForm({ name: "", code: "", description: "", color_code: "yellow", container_type: "", max_storage_hours: "24", requires_incineration: false });
    loadData();
  };

  const addLog = async (e) => {
    e.preventDefault();
    const cat = categories.find(c => c.id === logForm.waste_category_id);
    await base44.entities.WasteLog.create({
      ...logForm,
      category_code: cat?.code || "",
      quantity_kg: Number(logForm.quantity_kg),
      container_count: Number(logForm.container_count),
      generated_at: new Date().toISOString(),
      generated_by: "current_user",
      status: "generated",
      sla_deadline: new Date(Date.now() + (cat?.max_storage_hours || 24) * 3600000).toISOString(),
    });
    setShowLogForm(false);
    setLogForm({ waste_category_id: "", origin_department: "nursing", quantity_kg: "", container_count: "1", disposal_method: "incineration", notes: "" });
    loadData();
  };

  const advanceStatus = async (logId, currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    if (idx < STATUS_FLOW.length - 1) {
      const nextStatus = STATUS_FLOW[idx + 1];
      const update = { status: nextStatus };
      if (nextStatus === "collected") update.collected_at = new Date().toISOString();
      if (nextStatus === "treated") update.treated_at = new Date().toISOString();
      await base44.entities.WasteLog.update(logId, update);
      loadData();
    }
  };

  const handleSignDisposal = (log) => {
    setSigningLog(log);
  };

  const handleSaveSignature = async (file) => {
    if (!signingLog) return;
    setSavingSignature(true);
    try {
      const { data: uploadData } = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke("saveSignature", {
        file_url: uploadData.file_url,
        document_type: "discharge_summary",
        document_id: signingLog.id,
        patient_id: "",
        visit_id: "",
      });
      await base44.entities.WasteLog.update(signingLog.id, {
        signature_url: uploadData.file_url,
        signed_by: "current_user",
        signed_by_name: "Staff Member",
        signed_at: new Date().toISOString(),
        status: "disposed",
      });
      setSigningLog(null);
      loadData();
    } catch (e) {
      console.error('Signature save failed:', e);
    } finally {
      setSavingSignature(false);
    }
  };

  const filteredLogs = logs.filter(l => {
    if (filterDept && l.origin_department !== filterDept) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const slaBreached = logs.filter(l => l.sla_breached).length;
  const pendingCollection = logs.filter(l => l.status === "generated" || l.status === "segregated").length;
  const disposedToday = logs.filter(l => {
    const d = new Date(l.treated_at || l.collected_at || l.created_date);
    const today = new Date();
    return l.status === "disposed" && d.toDateString() === today.toDateString();
  }).length;
  const totalVolumeToday = filteredLogs
    .filter(l => { const d = new Date(l.generated_at || l.created_date); const today = new Date(); return d.toDateString() === today.toDateString(); })
    .reduce((sum, l) => sum + (l.quantity_kg || 0), 0);

  const getCategory = (id) => categories.find(c => c.id === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SLA Breached</p>
              <p className={`text-xl font-bold ${slaBreached > 0 ? "text-destructive" : ""}`}>{slaBreached}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-chart-2/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-xl font-bold">{pendingCollection}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Needs Incineration</p>
              <p className="text-xl font-bold">
                {filteredLogs.filter(l => {
                  const cat = getCategory(l.waste_category_id);
                  return cat?.requires_incineration && l.status !== "disposed";
                }).length}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Disposed Today</p>
              <p className="text-xl font-bold">{disposedToday}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Volume Today</p>
              <p className="text-xl font-bold">{totalVolumeToday.toFixed(1)} kg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            <option value="nursing">Nursing</option>
            <option value="clinical">Clinical</option>
            <option value="lab">Laboratory</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="inpatient">Inpatient</option>
            <option value="maternal">Maternal</option>
            <option value="theatre">Theatre</option>
          </select>
          <select
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUS_FLOW.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {(filterDept || filterStatus) && (
            <button onClick={() => { setFilterDept(""); setFilterStatus(""); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted">
            <Building2 className="w-3.5 h-3.5" /> Categories
          </button>
          <button onClick={() => setShowLogForm(true)} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> Log Waste
          </button>
        </div>
      </div>

      {/* Waste Categories */}
      <div className="mb-5">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Waste Categories</h4>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <span
              key={c.id}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${WHO_COLORS[c.color_code] || "bg-muted text-muted-foreground"}`}
              title={`${c.container_type || ""} • Max ${c.max_storage_hours}h storage`}
            >
              {c.name} {c.requires_incineration && "🔥"}
            </span>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No categories defined. Add waste categories first.</p>
          )}
        </div>
      </div>

      {/* Waste Log Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Date</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Category</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Department</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Qty (kg)</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Status</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Method</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Hazard</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Signature</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">SLA</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.slice(0, 100).map(log => {
              const cat = getCategory(log.waste_category_id);
              const isOverdue = log.sla_deadline && new Date(log.sla_deadline) < new Date() && log.status !== "disposed";
              const isSigned = log.signature_url && log.signed_at;
              return (
                <tr key={log.id} className={`border-b border-border/40 ${isOverdue ? "bg-destructive/5" : ""}`}>
                  <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                    {new Date(log.generated_at || log.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${WHO_COLORS[cat?.color_code] || "bg-muted text-muted-foreground"}`}>
                      {cat?.name || log.category_code}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 capitalize text-xs">{log.origin_department}</td>
                  <td className="py-2.5 px-3 text-xs font-mono">{log.quantity_kg || "—"}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      log.status === "disposed" ? "bg-chart-2/10 text-chart-2" :
                      log.status === "treated" ? "bg-chart-3/10 text-chart-3" :
                      log.status === "collected" ? "bg-chart-1/10 text-chart-1" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {STATUS_LABELS[log.status]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs capitalize">{log.disposal_method?.replace(/_/g, " ") || "—"}</td>
                  <td className="py-2.5 px-3">
                    {cat && cat.code !== "GEN" ? (
                      <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                        <AlertTriangle className="w-3 h-3" /> Hazardous
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">General</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {isSigned ? (
                      <span className="flex items-center gap-1 text-[10px] text-chart-3 font-medium">
                        <FileSignature className="w-3 h-3" /> Signed
                      </span>
                    ) : log.status !== "generated" ? (
                      <button
                        onClick={() => handleSignDisposal(log)}
                        className="px-2 py-0.5 bg-chart-3/10 text-chart-3 rounded text-[10px] font-medium hover:bg-chart-3/20 flex items-center gap-1"
                      >
                        <PenTool className="w-3 h-3" /> Sign
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {isOverdue ? (
                      <span className="text-destructive text-[10px] font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> OVERDUE
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {log.sla_deadline ? new Date(log.sla_deadline).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {log.status !== "disposed" && (
                      <button
                        onClick={() => advanceStatus(log.id, log.status)}
                        className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium hover:bg-primary/20 flex items-center gap-0.5"
                      >
                        <ArrowRight className="w-3 h-3" /> {STATUS_LABELS[STATUS_FLOW[STATUS_FLOW.indexOf(log.status) + 1]] || "Done"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredLogs.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">No waste logs recorded. Click "Log Waste" to start tracking.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Log Waste Modal */}
      {showLogForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLogForm(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-md mx-4">
            <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Log Clinical Waste
            </h3>
            <form onSubmit={addLog} className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Category *</label>
                <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={logForm.waste_category_id} onChange={e => setLogForm({...logForm, waste_category_id: e.target.value})}>
                  <option value="">Select waste category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Department *</label>
                  <select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={logForm.origin_department} onChange={e => setLogForm({...logForm, origin_department: e.target.value})}>
                    <option value="nursing">Nursing</option>
                    <option value="clinical">Clinical</option>
                    <option value="lab">Laboratory</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="inpatient">Inpatient</option>
                    <option value="maternal">Maternal</option>
                    <option value="theatre">Theatre</option>
                    <option value="imaging">Imaging</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Disposal Method</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={logForm.disposal_method} onChange={e => setLogForm({...logForm, disposal_method: e.target.value})}>
                    <option value="incineration">Incineration 🔥</option>
                    <option value="autoclave">Autoclave</option>
                    <option value="chemical_treatment">Chemical Treatment</option>
                    <option value="landfill">Landfill</option>
                    <option value="recycling">Recycling</option>
                    <option value="sewer">Sewer</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Weight (kg)</label>
                  <input type="number" step="0.1" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={logForm.quantity_kg} onChange={e => setLogForm({...logForm, quantity_kg: e.target.value})} placeholder="0.0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Containers</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={logForm.container_count} onChange={e => setLogForm({...logForm, container_count: e.target.value})} placeholder="1" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={logForm.notes} onChange={e => setLogForm({...logForm, notes: e.target.value})} placeholder="Additional disposal details..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Save className="w-3 h-3 inline mr-1" /> Save Waste Log</button>
                <button type="button" onClick={() => setShowLogForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCategoryForm(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4">
            <h3 className="font-heading text-lg font-semibold mb-4">Add Waste Category</h3>
            <form onSubmit={addCategory} className="space-y-3">
              <div><label className="block text-xs text-muted-foreground mb-1">Name *</label><input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} placeholder="e.g. Infectious Waste" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Code *</label><input required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={categoryForm.code} onChange={e => setCategoryForm({...categoryForm, code: e.target.value})} placeholder="e.g. INF" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">WHO Color</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={categoryForm.color_code} onChange={e => setCategoryForm({...categoryForm, color_code: e.target.value})}>
                  <option value="yellow">Yellow — Infectious</option>
                  <option value="red">Red — Sharps</option>
                  <option value="brown">Brown — Pharmaceutical</option>
                  <option value="black">Black — General</option>
                  <option value="blue">Blue — Non-hazardous</option>
                </select>
              </div>
              <div><label className="block text-xs text-muted-foreground mb-1">Container Type</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={categoryForm.container_type} onChange={e => setCategoryForm({...categoryForm, container_type: e.target.value})} placeholder="e.g. Yellow bin, Sharps box" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">Max Storage (hrs)</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={categoryForm.max_storage_hours} onChange={e => setCategoryForm({...categoryForm, max_storage_hours: e.target.value})} /></div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={categoryForm.requires_incineration} onChange={e => setCategoryForm({...categoryForm, requires_incineration: e.target.checked})} className="rounded" />
                    Incineration
                  </label>
                </div>
              </div>
              <div><label className="block text-xs text-muted-foreground mb-1">Description</label><textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={categoryForm.description} onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} /></div>
              <div className="flex gap-3 pt-2"><button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save</button><button type="button" onClick={() => setShowCategoryForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Compliance Dashboard */}
      <div className="mt-8 border-t border-border pt-6">
        <WasteComplianceDashboard logs={logs} categories={categories} />
      </div>

      {/* Volume Trends Chart */}
      <div className="mt-8 bg-card rounded-xl border border-border/60 shadow-sm p-5">
        <WasteVolumeChart logs={logs} categories={categories} />
      </div>

      {/* Signature Pad Modal */}
      {signingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSigningLog(null)} />
          <div className="relative z-10 w-full max-w-lg mx-4">
            <SignaturePad
              title="Sign Waste Disposal Record"
              onSave={handleSaveSignature}
              onCancel={() => setSigningLog(null)}
              saving={savingSignature}
            />
          </div>
        </div>
      )}
    </div>
  );
}