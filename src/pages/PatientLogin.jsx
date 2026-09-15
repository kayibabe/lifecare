import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import { formatApiError } from "@/api/customClient";
import { ArrowLeft } from "lucide-react";

export default function PatientLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ mrn: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiClient.patientAuth.login(form.mrn, form.phone);
      navigate("/patient-portal", { replace: true });
    } catch (err) {
      setError(formatApiError(err, "That Patient ID and phone number don't match our records."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-2xl shadow-sm">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-border">
            <div className="w-24 aspect-[1240/730] mx-auto mb-3 overflow-hidden">
              <img src="/logo.png" alt="LifeCare" className="w-full h-full object-cover object-top" />
            </div>
            <h1 className="text-base font-semibold text-foreground tracking-tight">LifeCare</h1>
            <p className="text-xs mt-1 text-muted-foreground tracking-wide uppercase">Patient Portal</p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Your Patient ID was given to you at registration. Enter it with the phone
              number you registered.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="mrn" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Patient ID
                </label>
                <input
                  id="mrn"
                  type="text"
                  required
                  autoComplete="off"
                  value={form.mrn}
                  onChange={(e) => setForm({ ...form, mrn: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground/60
                             focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="LifeCare000123"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground/60
                             focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="099 123 4567"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
                  <p className="text-sm text-destructive leading-snug">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <Link
              to="/"
              className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back to main page
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          LifeCare Clinical Information System · Secured
        </p>
      </div>
    </div>
  );
}
