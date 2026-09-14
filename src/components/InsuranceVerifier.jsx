import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, ShieldX, ShieldAlert, Loader2 } from "lucide-react";

export default function InsuranceVerifier({ patientId, patientName, schemeName, memberNumber, onVerification }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  const verify = async () => {
    setVerifying(true);
    try {
      const { data } = await base44.functions.invoke('verifyInsurance', { patient_id: patientId });
      setResult(data);
      onVerification?.(data);
    } catch (e) {
      setResult({ verified: false, status: 'error', message: 'Verification failed. Please try again.' });
    } finally {
      setVerifying(false);
    }
  };

  const statusConfig = {
    covered: { icon: ShieldCheck, color: 'text-chart-3', bg: 'bg-chart-3/10', border: 'border-chart-3/30' },
    not_covered: { icon: ShieldX, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
    self_pay: { icon: ShieldAlert, color: 'text-chart-4', bg: 'bg-chart-4/10', border: 'border-chart-4/30' },
    inactive_scheme: { icon: ShieldX, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
    missing_member_number: { icon: ShieldAlert, color: 'text-chart-2', bg: 'bg-chart-2/10', border: 'border-chart-2/30' },
    error: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
  };

  const config = statusConfig[result?.status] || statusConfig.error;
  const StatusIcon = config.icon;

  return (
    <div className="mt-3 space-y-2">
      {!result && (
        <button
          onClick={verify}
          disabled={verifying}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {verifying ? 'Verifying...' : 'Verify Insurance'}
        </button>
      )}

      {result && (
        <div className={`p-3 rounded-lg border ${config.bg} ${config.border}`}>
          <div className="flex items-start gap-2">
            <StatusIcon className={`w-4 h-4 mt-0.5 ${config.color}`} />
            <div>
              <p className={`text-sm font-medium ${config.color}`}>
                {result.status === 'covered' ? 'Insurance Verified' : 
                 result.status === 'not_covered' ? 'Coverage Warning' :
                 result.status === 'self_pay' ? 'Self-Pay Patient' :
                 result.status === 'inactive_scheme' ? 'Scheme Inactive' :
                 result.status === 'missing_member_number' ? 'Missing Member Number' :
                 'Verification Failed'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{result.message}</p>
              {result.member_number && (
                <p className="text-xs text-muted-foreground mt-1">
                  Member: {result.member_number} • Scheme: {result.scheme_name}
                </p>
              )}
              <button
                onClick={verify}
                disabled={verifying}
                className="text-xs text-primary hover:underline mt-1.5 inline-flex items-center gap-1"
              >
                {verifying && <Loader2 className="w-3 h-3 animate-spin" />}
                Re-verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}