import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';


export default function CustomLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkUserAuth, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ employee_id: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const next = searchParams.get('next') || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, navigate, next]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient.auth.login(form.employee_id, form.password);
      await checkUserAuth();
      navigate(next, { replace: true });
    } catch (err) {
      setError(
        err?.data?.detail ||
        err?.message ||
        'Invalid credentials. Please check your Employee ID and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-border">
            <div className="w-36 h-36 mx-auto mb-3">
              <img
                src="/lifecare-mark.png"
                alt="LifeCare"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              LifeCare
            </h1>
            <p className="text-[11px] mt-1 text-muted-foreground tracking-widest uppercase">
              Health Management Information System
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Employee ID */}
              <div>
                <label
                  htmlFor="employee_id"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Employee ID
                </label>
                <input
                  id="employee_id"
                  type="text"
                  required
                  autoComplete="username"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground/60
                             focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="DR001"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 pr-10 text-sm bg-background border border-border rounded-lg text-foreground
                               focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
                  <p className="text-sm text-destructive leading-snug">{error}</p>
                </div>
              )}

              {/* Submit */}
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

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          LifeCare Clinical Information System · Secured
        </p>
      </div>
    </div>
  );
}
