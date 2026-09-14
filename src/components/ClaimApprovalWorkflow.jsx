import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Clock, FileText, Download, Send, Loader2, X } from "lucide-react";

export default function ClaimApprovalWorkflow() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [patients, setPatients] = useState({});
  const [approving, setApproving] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadPendingClaims();
  }, []);

  const loadPendingClaims = async () => {
    try {
      const data = await base44.entities.InsuranceClaim.filter(
        { status: { $in: ["pending", "submitted", "approved"] } },
        "-created_date",
        100
      );
      setClaims(data);

      const pMap = {};
      await Promise.all(
        data.map(async (claim) => {
          if (claim.patient_id && !pMap[claim.patient_id]) {
            try {
              const p = await base44.entities.Patient.get(claim.patient_id);
              if (p) pMap[claim.patient_id] = `${p.first_name} ${p.last_name}`;
            } catch (_) {}
          }
        })
      );
      setPatients(pMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const approveClaim = async (claimId) => {
    setApproving(true);
    try {
      await base44.entities.InsuranceClaim.update(claimId, {
        status: "approved"
      });
      await loadPendingClaims();
      setSelectedClaim(null);
    } catch (e) {
      alert("Approval failed: " + e.message);
    } finally {
      setApproving(false);
    }
  };

  const exportClaimPDF = async (claimId) => {
    setExporting(claimId);
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim.invoice_id) {
        alert("No invoice linked to this claim");
        return;
      }

      const { data } = await base44.functions.invoke("exportClaimFormPdf", {
        invoice_id: claim.invoice_id,
        scheme_id: claim.scheme_id || "liberty"
      });

      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data.pdf_base64}`;
      link.download = data.filename;
      link.click();
    } catch (e) {
      alert("Export failed: " + e.message);
    } finally {
      setExporting(null);
    }
  };

  const syncToGoogleDrive = async (claimId) => {
    setSyncing(true);
    try {
      const { data } = await base44.functions.invoke("syncClaimsToDrive", {
        claim_id: claimId
      });
      alert(`✅ Synced to Google Drive\nFile: ${data.file_name || claimId}`);
    } catch (e) {
      alert("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const pendingClaims = claims.filter(c => c.status === "pending");
  const submittedClaims = claims.filter(c => c.status === "submitted");
  const approvedClaims = claims.filter(c => c.status === "approved");

  const ClaimCard = ({ claim, status }) => (
    <button
      onClick={() => setSelectedClaim(claim.id)}
      className="w-full text-left p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{patients[claim.patient_id] || "Unknown"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {claim.scheme_name} · MWK {(claim.claim_amount || 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">ID: {claim.id.slice(0, 8)}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
          status === "pending"
            ? "bg-chart-4/10 text-chart-4"
            : status === "submitted"
            ? "bg-chart-1/10 text-chart-1"
            : "bg-chart-3/10 text-chart-3"
        }`}>
          {status}
        </span>
      </div>
    </button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Workflow Stages */}
      <div>
        <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-chart-4" /> Pending ({pendingClaims.length})
        </h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pendingClaims.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No pending claims</p>
          ) : (
            pendingClaims.map(claim => <ClaimCard key={claim.id} claim={claim} status="pending" />)
          )}
        </div>
      </div>

      <div>
        <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-chart-1" /> Submitted ({submittedClaims.length})
        </h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {submittedClaims.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No submitted claims</p>
          ) : (
            submittedClaims.map(claim => <ClaimCard key={claim.id} claim={claim} status="submitted" />)
          )}
        </div>
      </div>

      <div>
        <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-chart-3" /> Approved ({approvedClaims.length})
        </h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {approvedClaims.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No approved claims</p>
          ) : (
            approvedClaims.map(claim => <ClaimCard key={claim.id} claim={claim} status="approved" />)
          )}
        </div>
      </div>

      {/* Claim Details & Actions */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedClaim(null)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
            {(() => {
              const claim = claims.find(c => c.id === selectedClaim);
              if (!claim) return null;

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" /> Claim Details
                    </h3>
                    <button onClick={() => setSelectedClaim(null)} className="p-1 rounded hover:bg-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Patient</p>
                      <p className="text-sm font-semibold mt-1">{patients[claim.patient_id] || "Unknown"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Scheme</p>
                      <p className="text-sm font-semibold mt-1">{claim.scheme_name}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Amount</p>
                      <p className="text-sm font-semibold font-mono mt-1">MWK {(claim.claim_amount || 0).toLocaleString()}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Status</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 capitalize ${
                        claim.status === "pending"
                          ? "bg-chart-4/10 text-chart-4"
                          : claim.status === "submitted"
                          ? "bg-chart-1/10 text-chart-1"
                          : "bg-chart-3/10 text-chart-3"
                      }`}>
                        {claim.status}
                      </span>
                    </div>

                    {claim.response_notes && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
                        <p className="text-xs text-foreground">{claim.response_notes}</p>
                      </div>
                    )}

                    {/* Workflow Actions */}
                    <div className="border-t border-border pt-4 space-y-2">
                      {claim.status === "pending" && (
                        <button
                          onClick={async () => {
                            await base44.entities.InsuranceClaim.update(claim.id, {
                              status: "submitted",
                              submitted_date: new Date().toISOString()
                            });
                            await loadPendingClaims();
                            setSelectedClaim(null);
                          }}
                          className="w-full px-3 py-2 bg-chart-1 text-white rounded-lg text-xs font-medium hover:bg-chart-1/90"
                        >
                          Submit Claim
                        </button>
                      )}

                      {claim.status !== "approved" && (
                        <button
                          onClick={() => approveClaim(claim.id)}
                          disabled={approving}
                          className="w-full px-3 py-2 bg-chart-3 text-white rounded-lg text-xs font-medium hover:bg-chart-3/90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          {approving ? "Approving..." : "Approve"}
                        </button>
                      )}

                      <button
                        onClick={() => exportClaimPDF(claim.id)}
                        disabled={exporting === claim.id}
                        className="w-full px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {exporting === claim.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        {exporting === claim.id ? "Exporting..." : "Export PDF"}
                      </button>

                      <button
                        onClick={() => syncToGoogleDrive(claim.id)}
                        disabled={syncing}
                        className="w-full px-3 py-2 bg-chart-2/10 text-chart-2 rounded-lg text-xs font-medium hover:bg-chart-2/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {syncing ? "Syncing..." : "Sync to Drive"}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}