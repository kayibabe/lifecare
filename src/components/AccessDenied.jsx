import { useNavigate } from "react-router-dom";
import { formatRole } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { ShieldAlert } from "lucide-react";

export default function AccessDenied() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-800">You don't have access to this page</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Your role ({formatRole(user?.role) || "unknown"}) isn't permitted to view this section.
            If you believe this is a mistake, contact an administrator.
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90 transition-opacity"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
