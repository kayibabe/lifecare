import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileDown, Loader2 } from "lucide-react";

export default function RoleBasedReportDownload({ userRole }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const roleReports = {
    doctor: [
      { id: "clinical_summary", label: "Clinical Summary", desc: "My consultations & diagnoses" },
      { id: "patient_list", label: "Patient List", desc: "My active patients" },
    ],
    clinician: [
      { id: "clinical_summary", label: "Clinical Summary", desc: "My consultations & diagnoses" },
      { id: "patient_list", label: "Patient List", desc: "My active patients" },
    ],
    nurse: [
      { id: "nursing_tasks", label: "Nursing Tasks", desc: "Care tasks & interventions" },
      { id: "patient_list", label: "Patient List", desc: "My assigned patients" },
    ],
    cashier: [
      { id: "revenue", label: "Revenue Report", desc: "Today's transactions" },
      { id: "invoice_list", label: "Invoice List", desc: "All processed invoices" },
    ],
    pharmacist: [
      { id: "dispensing", label: "Dispensing Report", desc: "Drugs dispensed today" },
      { id: "inventory", label: "Inventory Status", desc: "Stock levels & reorders" },
    ],
    receptionist: [
      { id: "visits", label: "Visit Summary", desc: "Check-ins & queue status" },
      { id: "appointments", label: "Appointment Report", desc: "Today's scheduled visits" },
    ],
    admin: [
      { id: "daily", label: "Daily Report", desc: "Overall facility summary" },
      { id: "revenue", label: "Revenue Report", desc: "Financial breakdown" },
      { id: "visits", label: "Visit Analytics", desc: "Patient flow data" },
    ],
  };

  const reports = roleReports[userRole] || [];

  if (reports.length === 0) return null;

  const downloadReport = async (reportId) => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await base44.functions.invoke("batchExportReports", {
        reports: [reportId],
      });

      if (data?.exports?.[reportId]?.data) {
        const reportData = data.exports[reportId].data;
        const headers = Object.keys(reportData[0]);
        const csv = [
          headers.join(","),
          ...reportData.map((row) =>
            headers
              .map((h) => JSON.stringify(row[h] || "").replace(/"/g, '""'))
              .join(",")
          ),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportId}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setResult({ status: "success", message: "Report downloaded successfully" });
      }
    } catch (e) {
      setResult({ status: "error", message: "Failed to download report" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-border p-5">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <FileDown className="w-4 h-4 text-primary" /> Download My Reports
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => downloadReport(report.id)}
            disabled={loading}
            className="px-3 py-2 rounded border border-border hover:bg-muted/50 text-left transition-colors disabled:opacity-50 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{report.label}</p>
                <p className="text-[11px] text-muted-foreground">{report.desc}</p>
              </div>
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-2 flex-shrink-0" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-primary ml-2 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
      {result && (
        <div
          className={`mt-3 p-2 rounded text-xs ${
            result.status === "success"
              ? "bg-chart-3/10 text-chart-3"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}